// NotesModule.js - Enhanced with null-check guards
window.NotesModule = {
  init: function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return; // Null-check guard
    
    this.container = container;
    this.notes = this.loadNotes();
    this.render();
  },
  
  loadNotes: function() {
    try {
      const stored = localStorage.getItem('cryptoExplorer.v2.notes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  
  saveNotes: function() {
    try {
      localStorage.setItem('cryptoExplorer.v2.notes', JSON.stringify(this.notes));
    } catch {}
  },
  
  addNote: function(sectionId, text) {
    if (!text || !sectionId) return;
    
    const note = {
      id: Date.now().toString(),
      sectionId,
      text,
      createdAt: new Date().toISOString()
    };
    
    this.notes.push(note);
    this.saveNotes();
    this.render();
  },
  
  render: function() {
    if (!this.container) return; // Null-check guard
    
    this.container.innerHTML = this.notes.map(note => `
      <div class="note-item" data-id="${note.id}">
        <div class="note-text">${note.text}</div>
        <div class="note-meta">${new Date(note.createdAt).toLocaleDateString()}</div>
        <button onclick="NotesModule.deleteNote('${note.id}')">Delete</button>
      </div>
    `).join('');
  },
  
  deleteNote: function(noteId) {
    this.notes = this.notes.filter(n => n.id !== noteId);
    this.saveNotes();
    this.render();
  },
  
  destroy: function() {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
};