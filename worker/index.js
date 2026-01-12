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

      // List all posts
      if (url.pathname === "/api/posts" && method === "GET") {
        return await listPosts(env);
      }

      // Get post by slug (for frontend)
      if (url.pathname.match(/^\/api\/post\/[^/]+$/) && method === "GET") {
        const slug = url.pathname.split("/").pop();
        return await getPostBySlug(env, slug);
      }

      // Create new post
      if (url.pathname === "/api/post" && method === "POST") {
        return await createPost(env, request);
      }

      // Update/Delete post by ID (for admin)
      if (url.pathname.startsWith("/api/post/") && method !== "GET") {
        const id = url.pathname.split("/").pop();

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
  const objects = await env.BLOG.list();
  const posts = [];

  for (const obj of objects.objects) {
    const key = obj.key;

    if (key.endsWith(".json")) {
      const data = await env.BLOG.get(key);
      const post = JSON.parse(await data.text());
      posts.push({
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        author: post.author,
        tags: post.tags,
        created_at: post.created_at
      });
    }
  }

  // newest first
  posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return new Response(JSON.stringify(posts), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Get single post by slug (for frontend)
async function getPostBySlug(env, slug) {
  const objects = await env.BLOG.list();

  for (const obj of objects.objects) {
    if (obj.key.endsWith(".json")) {
      const data = await env.BLOG.get(obj.key);
      const post = JSON.parse(await data.text());

      if (post.slug === slug) {
        const body = await env.BLOG.get(`${post.id}.md`);
        const md = await body.text();

        return new Response(JSON.stringify({
          ...post,
          content: md
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }
  }

  return new Response(JSON.stringify({ error: "Post not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Get single post by ID (for admin)
async function getPostById(env, id) {
  const meta = await env.BLOG.get(`${id}.json`);
  const body = await env.BLOG.get(`${id}.md`);

  if (!meta || !body) {
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const metadata = JSON.parse(await meta.text());
  const md = await body.text();

  return new Response(JSON.stringify({
    ...metadata,
    body: md
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Helper to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Create new post
async function createPost(env, request) {
  const data = await request.json();
  const { title, body, slug, summary, author, tags, published } = data;

  if (!title || !body) {
    return new Response(JSON.stringify({ error: "Title and body are required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const id = crypto.randomUUID();
  const postSlug = slug || generateSlug(title);
  const created_at = new Date().toISOString();

  const metadata = {
    id,
    title,
    slug: postSlug,
    summary: summary || '',
    author: author || 'Josh Fisher',
    tags: tags || '',
    created_at,
    published: published !== undefined ? published : true
  };

  await env.BLOG.put(`${id}.md`, body);
  await env.BLOG.put(`${id}.json`, JSON.stringify(metadata));

  return new Response(JSON.stringify(metadata), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Update existing post
async function updatePost(env, request, id) {
  const data = await request.json();
  const { title, body, slug, summary, author, tags, published } = data;

  if (!title || !body) {
    return new Response(JSON.stringify({ error: "Title and body are required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Get existing metadata to preserve created_at
  const existingMeta = await env.BLOG.get(`${id}.json`);
  if (!existingMeta) {
    return new Response(JSON.stringify({ error: "Post not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const existing = JSON.parse(await existingMeta.text());

  const postSlug = slug || existing.slug || generateSlug(title);

  const metadata = {
    id,
    title,
    slug: postSlug,
    summary: summary !== undefined ? summary : existing.summary,
    author: author !== undefined ? author : existing.author,
    tags: tags !== undefined ? tags : existing.tags,
    created_at: existing.created_at,
    published: published !== undefined ? published : existing.published
  };

  await env.BLOG.put(`${id}.md`, body);
  await env.BLOG.put(`${id}.json`, JSON.stringify(metadata));

  return new Response(JSON.stringify(metadata), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

// Delete post
async function deletePost(env, id) {
  await env.BLOG.delete(`${id}.md`);
  await env.BLOG.delete(`${id}.json`);

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
