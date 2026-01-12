const quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Write your post content here...'
});

// Get editor content as HTML
window.getEditorContent = () => {
  return quill.root.innerHTML;
};

// Set editor content from HTML
window.setEditorContent = (html) => {
  quill.root.innerHTML = html;
};
