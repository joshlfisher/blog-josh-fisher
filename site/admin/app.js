// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const API_URL = "/api";     // <-- Worker must be routed to /api/*
const editor = document.getElementById("editor");
const postList = document.getElementById("post-list");
const statusBox = document.getElementById("status");

// Markdown converter
function md(text) {
    return window.marked.parse(text || "");
}

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
    setTimeout(() => { statusBox.innerText = ""; }, 3500);
}

// ------------------------------------------------------------
// LOAD POSTS
// ------------------------------------------------------------
async function loadPosts() {
    try {
        const posts = await api("/posts");

        postList.innerHTML = "";
        posts.forEach(p => {
            const row = document.createElement("div");
            row.className = "post-row";
            row.innerHTML = `
                <strong>${p.title}</strong>
                <span>${p.date}</span>
                <button data-id="${p.id}" class="edit">Edit</button>
                <button data-id="${p.id}" class="delete">Delete</button>
            `;
            postList.appendChild(row);
        });

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
            const post = await api(`/post/${id}`);
            document.getElementById("post-id").value = id;
            document.getElementById("title").value = post.title;
            editor.value = post.body;

            flash("Loaded post for editing.", true);
        } catch {
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
    const body = editor.value.trim();

    if (!title || !body) {
        flash("Title/body cannot be empty.");
        return;
    }

    const payload = JSON.stringify({ title, body });

    try {
        const saved = await api(id ? `/post/${id}` : "/post", {
            method: id ? "PUT" : "POST",
            body: payload
        });

        flash("Post saved!", true);
        document.getElementById("post-id").value = "";
        document.getElementById("title").value = "";
        editor.value = "";

        loadPosts();

    } catch (err) {
        flash("Publish failed: " + err.message);
    }
});

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
loadPosts();
