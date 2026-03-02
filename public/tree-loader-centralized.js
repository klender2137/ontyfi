// Tree data loader - MODULAR structure support
// Loads from cryptoTree.merged.json which contains all branches with resolved descriptions
(function loadTreeData() {
  async function loadMergedTree() {
    try {
      console.log('Loading tree data from modular structure...');
      
      let mergedTree = null;
      
      // Try API first (server should return merged tree)
      try {
        const apiResponse = await fetch('/api/tree');
        if (apiResponse.ok) {
          mergedTree = await apiResponse.json();
          console.log('✅ Tree loaded from API:', mergedTree?.fields?.length || 0, 'branches');
        }
      } catch (apiError) {
        console.warn('API not available, trying merged JSON file:', apiError.message);
      }
      
      // Fallback to merged JSON file (full tree with all branches)
      if (!mergedTree) {
        // try the pre-generated merged file first
        try {
          const response = await fetch('/data/cryptoTree.merged.json');
          if (response.ok) {
            mergedTree = await response.json();
            console.log('✅ Tree loaded from merged JSON:', mergedTree?.fields?.length || 0, 'branches');
          }
        } catch (e) {
          console.warn('merged JSON not available, will try trunk:', e.message);
        }
      }

      // fallback to trunk-only data if still missing
      if (!mergedTree) {
        const response = await fetch('/data/cryptoTree.json');
        if (response.ok) {
          mergedTree = await response.json();
          console.log('⚠️ Loaded trunk-only tree data with', mergedTree?.fields?.length || 0, 'fields');
          // note: descriptions for deeper nodes won't be resolved until API or client-side fetch
        }
      }
      
      // Validate and set tree data
      if (mergedTree && mergedTree.fields && Array.isArray(mergedTree.fields)) {
        // Clear any existing tree data to prevent conflicts
        window.cryptoHustleTree = null;
        
        // Set the merged tree data
        window.cryptoHustleTree = mergedTree;
        
        console.log('✅ Modular tree data loaded:', mergedTree.fields.length, 'branches');
        
        // Notify all components of the update
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('treeUpdated', {
            detail: mergedTree
          }));
        }, 100);
      } else {
        throw new Error('Invalid tree structure - expected merged tree with fields array');
      }
      
    } catch (error) {
      console.error('❌ Failed to load modular tree data:', error.message);
      
      // Try fallback to old cryptoTree.json (trunk only)
      try {
        console.log('⚠️ Attempting fallback to trunk file...');
        const trunkResponse = await fetch('/data/cryptoTree.json');
        if (trunkResponse.ok) {
          const trunk = await trunkResponse.json();
          if (trunk.fields) {
            // Create minimal tree structure
            window.cryptoHustleTree = { fields: [] };
            console.log('⚠️ Using trunk-only fallback - branches not loaded');
          }
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError.message);
      }
      
      // Ensure we have at least empty tree structure
      if (!window.cryptoHustleTree) {
        window.cryptoHustleTree = { fields: [] };
        console.log('⚠️ Using empty tree as final fallback');
      }
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMergedTree);
  } else {
    loadMergedTree();
  }
})();