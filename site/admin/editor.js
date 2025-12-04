const quill = new Quill('#editor', { theme: 'snow' });
window.getEditorContent = () => quill.root.innerHTML;
window.setEditorContent = (html) => quill.root.innerHTML = html;
