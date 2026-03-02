// Module readiness flags - no dependencies
window.HustleReadiness = (() => {
  const flags = {};
  const listeners = [];

  return {
    set: (module, ready) => {
      flags[module] = ready;
      listeners.forEach(fn => fn(flags));
    },
    get: (module) => flags[module] || false,
    all: () => ({ ...flags }),
    subscribe: (fn) => {
      listeners.push(fn);
      fn(flags);
      return () => listeners = listeners.filter(l => l !== fn);
    }
  };
})();