// Atomic modal state - no dependencies
window.HustleModalState = (() => {
  let isOpen = false;
  let selectedItem = null;
  let listeners = [];

  return {
    isOpen: () => isOpen,
    getItem: () => selectedItem,
    open: (item) => {
      isOpen = true;
      selectedItem = item;
      listeners.forEach(fn => fn({ isOpen, item }));
    },
    close: () => {
      isOpen = false;
      selectedItem = null;
      listeners.forEach(fn => fn({ isOpen: false, item: null }));
    },
    subscribe: (fn) => {
      listeners.push(fn);
      fn({ isOpen, item: selectedItem });
      return () => listeners = listeners.filter(l => l !== fn);
    }
  };
})();