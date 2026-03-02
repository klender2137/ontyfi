// Atomic feed state - no dependencies
window.HustleFeedState = (() => {
  let items = [];
  let listeners = [];
  let ready = false;

  return {
    get: () => items,
    set: (newItems) => {
      items = Array.isArray(newItems) ? newItems : [];
      ready = true;
      listeners.forEach(fn => fn(items));
    },
    subscribe: (fn) => {
      listeners.push(fn);
      if (ready) fn(items);
      return () => listeners = listeners.filter(l => l !== fn);
    },
    isReady: () => ready,
    clear: () => {
      items = [];
      ready = false;
      listeners.forEach(fn => fn([]));
    }
  };
})();