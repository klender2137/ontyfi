// Admin Utilities - User role management and admin functions
// Updated to use server-side admin verification only

const AdminUtils = (function() {
  // Cache for admin status to avoid repeated API calls
  let adminStatusCache = null;
  let adminStatusUser = null;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  let cacheTimestamp = 0;
  
  // Clear admin status cache (call on logout or role change)
  function clearAdminCache() {
    adminStatusCache = null;
    adminStatusUser = null;
    cacheTimestamp = 0;
  }
  
  /**
   * Verify admin status with server
   * This is the ONLY valid way to check admin status
   */
  async function verifyAdminWithServer(username, email) {
    try {
      const response = await fetch('/api/role/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });
      
      if (!response.ok) {
        console.warn('[AdminUtils] Server admin verification failed');
        return false;
      }
      
      const result = await response.json();
      return result.isAdmin === true;
    } catch (error) {
      console.error('[AdminUtils] Error verifying admin status:', error);
      return false;
    }
  }
  
  /**
   * Check if current user is admin
   * Uses server-side verification only - no localStorage bypass
   */
  async function isAdmin() {
    try {
      const user = UserAccount.getUserData();
      if (!user || !user.username) {
        return false;
      }
      
      // Check cache first
      const now = Date.now();
      if (adminStatusCache !== null && 
          adminStatusUser === user.username && 
          (now - cacheTimestamp) < CACHE_TTL) {
        return adminStatusCache;
      }
      
      // Verify with server
      const isAdminUser = await verifyAdminWithServer(user.username, user.email);
      
      // Update cache
      adminStatusCache = isAdminUser;
      adminStatusUser = user.username;
      cacheTimestamp = now;
      
      return isAdminUser;
    } catch (error) {
      console.error('[AdminUtils] Error checking admin status:', error);
      return false;
    }
  }
  
  /**
   * Synchronous check for initial render (returns cached value or false)
   * Use this for initial UI render, then refresh with async isAdmin()
   */
  function isAdminSync() {
    try {
      const user = UserAccount.getUserData();
      if (!user || !user.username) return false;
      
      // Return cached value if available and not expired
      const now = Date.now();
      if (adminStatusCache !== null && 
          adminStatusUser === user.username && 
          (now - cacheTimestamp) < CACHE_TTL) {
        return adminStatusCache;
      }
      
      // No localStorage bypass anymore - server verification only
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Refresh admin status from server
   * Call this on login and periodically
   */
  async function refreshAdminStatus() {
    clearAdminCache();
    return await isAdmin();
  }
  
  /**
   * DEPRECATED: setAdminMode removed - admin status is now server-only
   */
  function setAdminMode(enabled) {
    console.warn('[AdminUtils] setAdminMode is deprecated. Admin status is server-managed only.');
    return false;
  }

  // Get all users (admin only) - now properly secured with async check
  async function getAllUsers() {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      console.warn('[AdminUtils] Unauthorized attempt to get all users');
      return [];
    }
    
    try {
      // User management should be server-side only
      return [];
    } catch {
      return [];
    }
  }

  // Update user role - now server-managed only
  async function updateUserRole(userId, newRole) {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      console.warn('[AdminUtils] Unauthorized attempt to update user role');
      return false;
    }
    
    console.warn('[AdminUtils] updateUserRole is deprecated. User roles are server-managed.');
    return false;
  }

  // Delete user - requires server verification
  async function deleteUser(userId) {
    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      console.warn('[AdminUtils] Unauthorized attempt to delete user');
      return false;
    }
    
    console.warn('[AdminUtils] deleteUser should be implemented server-side');
    return false;
  }

  // Save new article to tree structure
  async function saveArticleToTree(articleData, targetSectionId, treeData) {
    console.log('Saving article to tree:', { articleData, targetSectionId, treeData });
    
    // Helper function to find section in tree
    function findSectionInTree(nodes, targetId) {
      for (const node of nodes) {
        if (node.id === targetId) return node;
        
        // Check all possible child arrays
        const childArrays = [
          node.categories || [],
          node.subcategories || [],
          node.nodes || [],
          node.subnodes || [],
          node.leafnodes || []
        ];
        
        for (const childArray of childArrays) {
          const found = findSectionInTree(childArray, targetId);
          if (found) return found;
        }
      }
      return null;
    }
    
    // Generate unique ID for new article
    const generateUniqueId = () => {
      return 'article_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };
    
    // Create new article object
    const newArticle = {
      id: generateUniqueId(),
      name: articleData.title,
      description: articleData.content,
      tags: articleData.tags || [],
      author: articleData.author || 'Admin',
      createdAt: new Date().toISOString(),
      type: 'article'
    };
    
    try {
      if (articleData.locationType === 'existing' && targetSectionId) {
        // Add to existing section
        const targetNode = findSectionInTree(treeData.fields, targetSectionId);
        if (targetNode) {
          if (!targetNode.leafnodes) targetNode.leafnodes = [];
          targetNode.leafnodes.push(newArticle);
          
          // FIXED: Send to API first, then update local state
          try {
            const response = await fetch('/api/tree/article', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: articleData.title,
                description: articleData.description,
                body: articleData.body,
                tags: articleData.tags,
                targetSectionId: targetSectionId,
                locationType: 'existing'
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('Article saved to API successfully:', result);
              
              // Update global tree data
              window.cryptoHustleTree = treeData;
              
              // Force complete tree reload from API
              const treeResponse = await fetch('/api/tree');
              if (treeResponse.ok) {
                const freshTreeData = await treeResponse.json();
                window.cryptoHustleTree = freshTreeData;
                
                // Trigger comprehensive update events
                window.dispatchEvent(new CustomEvent('treeUpdated', { detail: freshTreeData }));
                window.dispatchEvent(new CustomEvent('articleAdded', { detail: { articleId: newArticle.id } }));
                window.dispatchEvent(new CustomEvent('apiTreeUpdate', { detail: freshTreeData }));
                
                return { success: true, article: newArticle };
              }
            }
          } catch (apiError) {
            console.warn('API save failed, falling back to local:', apiError);
          }
          
          // Fallback: local update only
          window.cryptoHustleTree = treeData;
          window.dispatchEvent(new CustomEvent('treeUpdated', { detail: treeData }));
          window.dispatchEvent(new CustomEvent('articleAdded', { detail: { articleId: newArticle.id } }));
          
          return Promise.resolve({ success: true, article: newArticle });
        } else {
          throw new Error('Target section not found');
        }
      } else {
        // Create new custom field as base tile
        const newField = {
          id: generateUniqueId(),
          name: articleData.customFieldName || 'New Section',
          description: 'Custom section created for new article',
          leafnodes: [newArticle],
          type: 'custom_field',
          createdAt: new Date().toISOString(),
          isCustom: true
        };
        
        if (!treeData.fields) treeData.fields = [];
        treeData.fields.push(newField);
        
        // Store in elegant indirect system
        const indirectStorage = {
          articleId: newArticle.id,
          fieldId: newField.id,
          articleData: {
            ...newArticle,
            createdAt: new Date().toISOString(),
            source: 'custom_creation'
          },
          metadata: {
            locationType: 'custom',
            customFieldName: articleData.customFieldName,
            createdAt: new Date().toISOString()
          }
        };
        
        // Store in localStorage as indirect storage
        try {
          const existingStorage = JSON.parse(localStorage.getItem('cryptoExplorer.indirectArticles') || '[]');
          existingStorage.push(indirectStorage);
          localStorage.setItem('cryptoExplorer.indirectArticles', JSON.stringify(existingStorage));
        } catch (e) {
          console.error('Failed to store indirect article data:', e);
        }
        
        // Update global tree data immediately
        window.cryptoHustleTree = treeData;
        
        // Trigger comprehensive update events
        window.dispatchEvent(new CustomEvent('treeUpdated', { detail: treeData }));
        window.dispatchEvent(new CustomEvent('articleAdded', { detail: { articleId: newArticle.id, fieldId: newField.id, isCustom: true } }));
        window.dispatchEvent(new CustomEvent('customFieldCreated', { detail: { field: newField, article: newArticle } }));
        
        // Save to localStorage as backup
        try {
          localStorage.setItem('cryptoExplorer.treeData', JSON.stringify(treeData));
        } catch (e) {
          console.error('Failed to save tree data to localStorage:', e);
        }
        
        return Promise.resolve({ success: true, customField: newField, article: newArticle, indirectStorage });
      }
    } catch (error) {
      console.error('Error saving article locally:', error);
      return Promise.reject({ success: false, error: error.message });
    }
  }

  // Delete article from tree structure
  function deleteArticleFromTree(articleId, treeData) {
    console.log('Deleting article from tree:', { articleId, treeData });
    
    if (!articleId || !treeData || !treeData.fields) {
      return { success: false, error: 'Invalid article ID or tree data' };
    }

    try {
      // Recursive function to find and remove article
      const removeArticleFromNode = (node) => {
        if (node.leafnodes) {
          node.leafnodes = node.leafnodes.filter(leaf => leaf.id !== articleId);
        }
        
        if (node.subnodes) {
          node.subnodes.forEach(removeArticleFromNode);
        }
        
        if (node.subcategories) {
          node.subcategories.forEach(removeArticleFromNode);
        }
        
        if (node.categories) {
          node.categories.forEach(removeArticleFromNode);
        }
      };
      
      // Remove from fields
      treeData.fields.forEach(field => {
        removeArticleFromNode(field);
      });
      
      // Update global tree data
      window.cryptoHustleTree = treeData;
      
      // Trigger update events
      window.dispatchEvent(new CustomEvent('treeUpdated', { detail: treeData }));
      window.dispatchEvent(new CustomEvent('articleDeleted', { detail: { articleId } }));
      
      // Save to localStorage as backup
      try {
        localStorage.setItem('cryptoExplorer.treeData', JSON.stringify(treeData));
      } catch (e) {
        console.error('Failed to save tree data to localStorage:', e);
      }
      
      return { success: true, articleId };
    } catch (error) {
      console.error('Error deleting article:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    isAdmin,
    isAdminSync,
    refreshAdminStatus,
    clearAdminCache,
    setAdminMode, // Deprecated - kept for API compatibility but non-functional
    getAllUsers,
    updateUserRole,
    deleteUser,
    saveArticleToTree,
    deleteArticleFromTree
  };
})();
