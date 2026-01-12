// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const API_URL = "/api";
const postList = document.getElementById("posts-list");
const statusBox = document.getElementById("status");

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
async function api(path, options = {}) {
    try {
        const res = await fetch(API_URL + path, {
            headers: { "Content-Type": "application/json" },
            ...options
        });

        // Handle empty response body safely
        const text = await res.text();
        if (!text) {
            console.error("Empty API response:", path, res.status);
            throw new Error("API returned empty response");
        }

        try {
            return JSON.parse(text);
        } catch {
            console.error("Invalid JSON:", text);
            throw new Error("API returned invalid JSON");
        }

    } catch (err) {
        console.error("API ERROR:", err);
        alert("API Error: " + err.message);
        throw err;
    }
}

function flash(msg, good = false) {
    statusBox.innerText = msg;
    statusBox.style.color = good ? "#5f5" : "#f55";
    statusBox.style.marginRight = "10px";
    setTimeout(() => { statusBox.innerText = ""; }, 3500);
}

// ------------------------------------------------------------
// LOAD POSTS
// ------------------------------------------------------------
async function loadPosts() {
    try {
        const posts = await api("/posts");

        let html = '<h2>Posts</h2>';
        if (posts.length === 0) {
            html += '<p style="color:var(--muted)">No posts yet. Create your first post above!</p>';
        } else {
            html += '<div class="post-list">';
            posts.forEach(p => {
                html += `
                    <div class="post-row" style="padding:12px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.05)">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <div>
                                <strong>${p.title}</strong>
                                <div class="meta">${new Date(p.created_at).toLocaleDateString()}</div>
                                ${p.summary ? `<div style="color:var(--muted);font-size:12px;margin-top:4px">${p.summary}</div>` : ''}
                            </div>
                            <div style="display:flex;gap:8px">
                                <button data-id="${p.id}" class="edit btn" style="padding:6px 12px;font-size:13px">Edit</button>
                                <button data-id="${p.id}" class="delete btn" style="padding:6px 12px;font-size:13px;background:#ef4444">Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        postList.innerHTML = html;

    } catch (err) {
        flash("Failed to load posts.");
    }
}

// ------------------------------------------------------------
// EDIT EXISTING POST
// ------------------------------------------------------------
postList.addEventListener("click", async e => {
    if (e.target.classList.contains("edit")) {
        const id = e.target.dataset.id;

        try {
            // Get all posts and find the one with matching ID
            const posts = await api("/posts");
            const post = posts.find(p => p.id === id);

            if (!post) {
                flash("Post not found.");
                return;
            }

            // Get full post details including body
            const fullPost = await api(`/post/${id}`);

            document.getElementById("post-id").value = id;
            document.getElementById("title").value = fullPost.title;
            document.getElementById("slug").value = fullPost.slug || '';
            document.getElementById("author").value = fullPost.author || '';
            document.getElementById("tags").value = fullPost.tags || '';
            document.getElementById("summary").value = fullPost.summary || '';
            document.getElementById("published").checked = fullPost.published;

            // Set editor content
            if (window.setEditorContent) {
                window.setEditorContent(fullPost.body || '');
            }

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            flash("Loaded post for editing.", true);
        } catch (err) {
            console.error("Error loading post:", err);
            flash("Failed to load the post.");
        }
    }

    if (e.target.classList.contains("delete")) {
        const id = e.target.dataset.id;
        if (!confirm("Delete this post?")) return;

        try {
            await api(`/post/${id}`, { method: "DELETE" });
            flash("Post deleted.", true);
            loadPosts();
        } catch {
            flash("Delete failed.");
        }
    }
});

// ------------------------------------------------------------
// PUBLISH POST (NEW OR UPDATE)
// ------------------------------------------------------------
document.getElementById("publish").addEventListener("click", async () => {
    const id = document.getElementById("post-id").value;
    const title = document.getElementById("title").value.trim();
    const slug = document.getElementById("slug").value.trim();
    const author = document.getElementById("author").value.trim();
    const tags = document.getElementById("tags").value.trim();
    const summary = document.getElementById("summary").value.trim();
    const published = document.getElementById("published").checked;

    // Get editor content
    let body = '';
    if (window.getEditorContent) {
        body = window.getEditorContent();
    }

    if (!title || !body) {
        flash("Title and content are required.");
        return;
    }

    const payload = JSON.stringify({
        title,
        body,
        slug: slug || null, // Let server generate if empty
        author: author || null,
        tags: tags || null,
        summary: summary || null,
        published
    });

    try {
        const saved = await api(id ? `/post/${id}` : "/post", {
            method: id ? "PUT" : "POST",
            body: payload
        });

        flash(id ? "Post updated!" : "Post published!", true);
        clearForm();
        loadPosts();

    } catch (err) {
        flash("Publish failed: " + err.message);
    }
});

// ------------------------------------------------------------
// CLEAR FORM
// ------------------------------------------------------------
document.getElementById("clear").addEventListener("click", () => {
    clearForm();
    flash("Form cleared.", true);
});

function clearForm() {
    document.getElementById("post-id").value = "";
    document.getElementById("title").value = "";
    document.getElementById("slug").value = "";
    document.getElementById("author").value = "Josh Fisher";
    document.getElementById("tags").value = "";
    document.getElementById("summary").value = "";
    document.getElementById("published").checked = true;

    if (window.setEditorContent) {
        window.setEditorContent('');
    }
}

// ------------------------------------------------------------
// AUTO-GENERATE SLUG FROM TITLE
// ------------------------------------------------------------
document.getElementById("title").addEventListener("input", (e) => {
    const slug = e.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    document.getElementById("slug").value = slug;
});

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
loadPosts();
