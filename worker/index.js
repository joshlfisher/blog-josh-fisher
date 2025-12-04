/**
 * Cloudflare Worker API for blog (posts CRUD, media upload to R2, media serving, KV cache)
 *
 * Bindings expected:
 * - BLOG_DB (D1)
 * - MEDIA_BUCKET (R2)
 * - BLOG_CACHE (KV)
 *
 * Note: Protect /admin paths with Cloudflare Access; the worker checks CF-Access header.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve API routes
    if (path.startsWith("/api/")) {
      return handleApi(request, env, path.replace(/^\/api/, ""));
    }

    // Serve media from R2 at /media/*
    if (path.startsWith("/media/")) {
      const key = decodeURIComponent(path.replace("/media/", ""));
      try {
        const object = await env.MEDIA_BUCKET.get(key);
        if (!object) return new Response("Not found", { status: 404 });
        const ct = object.httpMetadata && object.httpMetadata.contentType || "application/octet-stream";
        return new Response(object.body, {
          headers: { "content-type": ct, "cache-control": "public, max-age=31536000" }
        });
      } catch (e) {
        return new Response("Error fetching media", { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
}

async function handleApi(request, env, route) {
  const method = request.method;

  // GET /posts -> list published posts (cached)
  if (route === "/posts" && method === "GET") {
    const cacheKey = "posts_list_v1";
    const cached = await env.BLOG_CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, { headers: { "content-type": "application/json" } });
    }
    const res = await env.BLOG_DB.prepare("SELECT id,slug,title,summary,author,tags,published,created_at FROM posts WHERE published=1 ORDER BY created_at DESC").all();
    const out = JSON.stringify(res.results || []);
    await env.BLOG_CACHE.put(cacheKey, out, { expirationTtl: 300 });
    return new Response(out, { headers: { "content-type": "application/json" } });
  }

  // GET /post/:slug
  const m = route.match(/^\/post\/([^\/]+)$/);
  if (m && method === "GET") {
    const slug = decodeURIComponent(m[1]);
    const prepared = env.BLOG_DB.prepare("SELECT * FROM posts WHERE slug = ? LIMIT 1");
    const row = await prepared.bind(slug).first();
    if (!row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(row), { headers: { "content-type": "application/json" } });
  }

  // Admin routes - expect Cloudflare Access to authenticate the user and inject header
  const cfEmail = request.headers.get("CF-Access-Authenticated-User-Email") ||
                  request.headers.get("Cf-Access-Authenticated-User-Email") ||
                  request.headers.get("cf-access-authenticated-user-email");

  // POST /admin/post create
  if (route === "/admin/post" && method === "POST") {
    if (!cfEmail) return unauthorized();
    const payload = await request.json();
    const { slug, title, summary, content, tags, published, scheduled_at } = payload;
    if (!slug || !title || !content) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { "content-type": "application/json" } });
    const stmt = env.BLOG_DB.prepare("INSERT INTO posts (slug,title,summary,content,author,tags,published,scheduled_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))");
    const result = await stmt.bind(slug, title, summary || "", content, cfEmail, tags || "", published ? 1 : 0, scheduled_at || null).run();
    await env.BLOG_CACHE.delete("posts_list_v1");
    return new Response(JSON.stringify({ ok: true, id: result.lastRowId }), { headers: { "content-type": "application/json" } });
  }

  // PUT /admin/post/:id update
  const up = route.match(/^\/admin\/post\/(\d+)$/);
  if (up && method === "PUT") {
    if (!cfEmail) return unauthorized();
    const id = Number(up[1]);
    const payload = await request.json();
    const { slug, title, summary, content, tags, published, scheduled_at } = payload;
    await env.BLOG_DB.prepare("UPDATE posts SET slug=?,title=?,summary=?,content=?,author=?,tags=?,published=?,scheduled_at=?,updated_at=datetime('now') WHERE id=?")
      .bind(slug, title, summary || "", content, cfEmail, tags || "", published ? 1 : 0, scheduled_at || null, id).run();
    await env.BLOG_DB.prepare("INSERT INTO revisions (post_id, content) VALUES (?,?)").bind(id, content).run();
    await env.BLOG_CACHE.delete("posts_list_v1");
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  // DELETE /admin/post/:id
  const del = route.match(/^\/admin\/post\/(\d+)$/);
  if (del && method === "DELETE") {
    if (!cfEmail) return unauthorized();
    const id = Number(del[1]);
    await env.BLOG_DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    await env.BLOG_CACHE.delete("posts_list_v1");
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  // POST /admin/upload -> handle multipart or raw upload
  if (route === "/admin/upload" && method === "POST") {
    if (!cfEmail) return unauthorized();
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file) return new Response(JSON.stringify({ error: "no file" }), { status: 400, headers: { "content-type": "application/json" } });
      const filename = file.name || `upload-${Date.now()}`;
      const array = await file.arrayBuffer();
      const key = `uploads/${Date.now()}-${filename}`;
      await env.MEDIA_BUCKET.put(key, array, { httpMetadata: { contentType: file.type || "application/octet-stream" } });
      const url = `/media/${encodeURIComponent(key)}`;
      return new Response(JSON.stringify({ ok: true, key, url }), { headers: { "content-type": "application/json" } });
    } else {
      // raw upload with ?filename=
      const urlObj = new URL(request.url);
      const name = urlObj.searchParams.get("filename") || `upload-${Date.now()}`;
      const data = await request.arrayBuffer();
      const key = `uploads/${Date.now()}-${name}`;
      await env.MEDIA_BUCKET.put(key, data, { httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" } });
      return new Response(JSON.stringify({ ok: true, key, url: `/media/${encodeURIComponent(key)}` }), { headers: { "content-type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
}
