async function refreshPosts(){
  const r = await fetch('/api/posts');
  const data = await r.json();
  const container = document.getElementById('posts-list');
  container.innerHTML = '<h3>Posts</h3>' + (data.map(p => `
    <div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">
      <strong>${p.title}</strong> <span class="meta">${p.created_at}</span>
      <div style="margin-top:6px">
        <button onclick="edit(${p.id})" class="btn">Edit</button>
        <button onclick="del(${p.id})" class="btn" style="margin-left:8px">Delete</button>
      </div>
    </div>
  `).join(''));
}

async function publish(){
  const payload = {
    slug: document.getElementById('slug').value,
    title: document.getElementById('title').value,
    summary: document.getElementById('summary').value,
    content: window.getEditorContent(),
    published: document.getElementById('published').checked ? 1 : 0
  };
  const r = await fetch('/api/admin/post', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  if (r.ok) { alert('Posted'); refreshPosts(); } else { alert('Failed: '+JSON.stringify(j)); }
}

async function del(id){
  if(!confirm('Delete?')) return;
  await fetch('/api/admin/post/' + id, { method: 'DELETE' });
  refreshPosts();
}

window.edit = async function(id){
  const r = await fetch('/api/posts');
  const posts = await r.json();
  const p = posts.find(x => x.id == id);
  if (!p) { alert('Not found'); return; }
  document.getElementById('title').value = p.title;
  document.getElementById('slug').value = p.slug;
  document.getElementById('summary').value = p.summary || '';
  window.setEditorContent(p.content || '');
  document.getElementById('published').checked = !!p.published;
}

document.getElementById('publish').addEventListener('click', publish);
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const file = document.getElementById('file').files[0];
  if(!file) { alert('No file selected'); return; }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (data.url) {
    alert('Uploaded! Use URL: ' + data.url);
  } else {
    alert('Upload failed: ' + JSON.stringify(data));
  }
});

refreshPosts();
