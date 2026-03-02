// Admin Utilities - User role management and admin functions

const AdminUtils = (function() {
  const ADMIN_KEY = 'cryptoExplorer.isAdmin';
  const USERS_KEY = 'cryptoExplorer.users';
  
  // Check if current user is admin
  function isAdmin() {
    try {
      const user = UserAccount.getUserData();
      return user.role === 'admin' || localStorage.getItem(ADMIN_KEY) === 'true';
    } catch {
      return false;
    }
  }

  // Set admin mode (for testing/development)
  function setAdminMode(enabled) {
    try {
      const user = UserAccount.getUserData();
      user.role = enabled ? 'admin' : 'user';
      UserAccount.saveUser(user);
      localStorage.setItem(ADMIN_KEY, enabled ? 'true' : 'false');
      return true;
    } catch {
      return false;
    }
  }

  // Get all users (admin only)
  function getAllUsers() {
    if (!isAdmin()) return [];
    
    try {
      // In a real app, this would fetch from server
      // For now, we'll simulate with localStorage
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Return current user as example
      const currentUser = UserAccount.getUserData();
      return [{
        id: '1',
        username: currentUser.username,
        role: currentUser.role || 'user',
        joinDate: currentUser.personalInfo?.joinDate || new Date().toISOString(),
        activities: currentUser.activities || {}
      }];
    } catch {
      return [];
    }
  }

  // Update user role
  function updateUserRole(userId, newRole) {
    if (!isAdmin()) return false;
    
    try {
      const users = getAllUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex >= 0) {
        users[userIndex].role = newRole;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  // Delete user
  function deleteUser(userId) {
    if (!isAdmin()) return false;
    
    try {
      const users = getAllUsers();
      const filteredUsers = users.filter(u => u.id !== userId);
      localStorage.setItem(USERS_KEY, JSON.stringify(filteredUsers));
      return true;
    } catch {
      return false;
    }
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
    setAdminMode,
    getAllUsers,
    updateUserRole,
    deleteUser,
    saveArticleToTree,
    deleteArticleFromTree
  };
})();
