export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // ------------------------------
      // CORS for the admin frontend
      // ------------------------------
      if (method === "OPTIONS") {
        return new Response("", {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }

      const send = (obj, status = 200) =>
        new Response(JSON.stringify(obj), {
          status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });

      // ----------------------------------------------------------
      // ROUTES
      // ----------------------------------------------------------
      if (url.pathname === "/api/posts" && method === "GET") {
        return await listPosts(env);
      }

      if (url.pathname === "/api/post" && method === "POST") {
        return await createPost(env, request);
      }

      if (url.pathname.startsWith("/api/post/")) {
        const id = url.pathname.split("/").pop();

        if (method === "GET") return await getPost(env, id);
        if (method === "PUT") return await updatePost(env, request, id);
        if (method === "DELETE") return await deletePost(env, id);
      }

      return send({ error: "Not Found" }, 404);

    } catch (err) {
      console.error("Worker fatal error:", err);
      return new Response(
        JSON.stringify({ error: err.toString() }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
};

// ========================================================================
// API FUNCTIONS
// ========================================================================

// List all posts (sorted by date)
async function listPosts(env) {
  const objects = await env.BLOG.list(); // BLOG is the R2 binding
  const posts = [];

  for (const obj of objects.objects) {
    const key = obj.key;

    if (key.endsWith(".json")) {
      const data = await env.BLOG.get(key);
      const post = JSON.parse(await data.text());
      posts.push({ id: post.id, title: post.title, date: post.date });
    }
  }

  // newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  return new Response(JSON.stringify(posts), {
    headers: { "Content-Type": "application/json",
               "Access-Control-Allow-Origin": "*" }
  });
}

// Get single post
async function getPost(env, id) {
  const meta = await env.BLOG.get(`${id}.json`);
  const body = await env.BLOG.get(`${id}.md`);

  if (!meta || !body) {
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json",
                 "Access-Control-Allow-Origin": "*" }
    });
  }

  const metadata = JSON.parse(await meta.text());
  const md = await body.text();

  return new Response(JSON.stringify({ ...metadata, body: md }), {
    headers: { "Content-Type": "application/json",
               "Access-Control-Allow-Origin": "*" }
  });
}

// Create new post
async function createPost(env, request) {
  const { title, body } = await request.json();
  const id = crypto.randomUUID();
  const date = new Date().toISOString();

  const metadata = { id, title, date };

  await env.BLOG.put(`${id}.md`, body);
  await env.BLOG.put(`${id}.json`, JSON.stringify(metadata));

  return new Response(JSON.stringify(metadata), {
    headers: { "Content-Type": "application/json",
               "Access-Control-Allow-Origin": "*" }
  });
}

// Update existing post
async function updatePost(env, request, id) {
  const { title, body } = await request.json();
  const date = new Date().toISOString();

  const metadata = { id, title, date };

  await env.BLOG.put(`${id}.md`, body);
  await env.BLOG.put(`${id}.json`, JSON.stringify(metadata));

  return new Response(JSON.stringify(metadata), {
    headers: { "Content-Type": "application/json",
               "Access-Control-Allow-Origin": "*" }
  });
}

// Delete post
async function deletePost(env, id) {
  await env.BLOG.delete(`${id}.md`);
  await env.BLOG.delete(`${id}.json`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json",
               "Access-Control-Allow-Origin": "*" }
  });
}
