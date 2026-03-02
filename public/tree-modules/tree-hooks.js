// tree-hooks.js - Custom hooks for TreeScreen
if (typeof window !== 'undefined' && window.React) {
  const { useState, useCallback } = React;

  window.TreeHooks = {
    useNotes: () => {
      const [notes, setNotes] = useState(() => {
        try {
          const stored = localStorage.getItem('cryptoExplorer.v2.notes');
          return stored ? JSON.parse(stored) : [];
        } catch { return []; }
      });
      const saveNotes = useCallback((newNotes) => {
        try {
          localStorage.setItem('cryptoExplorer.v2.notes', JSON.stringify(newNotes));
          setNotes(newNotes);
        } catch {}
      }, []);
      const addNote = useCallback((sectionId, text) => {
        if (!text || !sectionId) return;
        const note = { id: Date.now().toString(), sectionId, text, createdAt: new Date().toISOString() };
        const newNotes = [...notes, note];
        saveNotes(newNotes);
      }, [notes, saveNotes]);
      const deleteNote = useCallback((noteId) => {
        const newNotes = notes.filter(n => n.id !== noteId);
        saveNotes(newNotes);
      }, [notes, saveNotes]);
      return { notes, addNote, deleteNote };
    },

    useExpansionState: () => {
      const [expandedIds, setExpandedIds] = useState(() => {
        try {
          localStorage.removeItem('cryptoExplorer.treeExpansion');
          return new Set();
        } catch { return new Set(); }
      });
      const saveExpansion = useCallback((next) => {
        try {
          // Support both direct Set updates and functional updates (prev => next)
          setExpandedIds(prev => {
            const resolved = (typeof next === 'function') ? next(prev) : next;
            const nextSet = resolved instanceof Set ? resolved : new Set(resolved || []);
            try {
              localStorage.setItem('cryptoExplorer.treeExpansion', JSON.stringify([...nextSet]));
            } catch {}
            return nextSet;
          });
        } catch {}
      }, []);
      return [expandedIds, saveExpansion];
    }
  };
}
