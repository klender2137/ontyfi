// tree-loader.js - Loads all TreeScreen modules in correct order
(function() {
  const modules = [
    '/tree-modules/tree-utils.js',
    '/tree-modules/tree-hooks.js',
    '/tree-modules/tree-layout.js',
    '/tree-modules/tree-smart-layout.js',
    '/tree-modules/tree-navigation.js',
    '/tree-modules/tree-components.js',
    '/TreeScreen.js'
  ];

  let loadedCount = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loadedCount++;
        console.log(`✅ Loaded ${src} (${loadedCount}/${modules.length})`);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadAllModules() {
    try {
      for (const module of modules) {
        await loadScript(module);
      }
      console.log('✅ All TreeScreen modules loaded successfully');
      window.dispatchEvent(new Event('treeScreenReady'));
    } catch (error) {
      console.error('❌ Failed to load TreeScreen modules:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllModules);
  } else {
    loadAllModules();
  }
})();
