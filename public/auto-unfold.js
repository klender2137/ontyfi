// auto-unfold.js - Dedicated auto-unfold mechanics for tree navigation
if (typeof window !== 'undefined') {
  window.AutoUnfold = {
    /**
     * Auto-unfold to a specific node by following its path
     * @param {string} nodeId - Target node ID to unfold to
     * @param {Object} options - Configuration options
     * @param {boolean} options.shouldCenter - Whether to center on the node after unfolding
     * @param {number} options.delay - Delay between each expansion step (ms)
     * @param {Function} options.onComplete - Callback when unfolding is complete
     * @param {Function} options.onError - Callback when unfolding fails
     */
    unfoldToNode: function(nodeId, options = {}) {
      const {
        shouldCenter = true,
        delay = 200,
        onComplete = null,
        onError = null,
        visualFeedback = true
      } = options;

      console.log('AutoUnfold: Starting unfold to node:', nodeId, options);

      // Validate inputs
      if (!nodeId) {
        console.error('AutoUnfold: No node ID provided');
        onError?.('No node ID provided');
        return false;
      }

      // Check if TreeScreen is available
      if (!window.TreeScreenExpandToNode || typeof window.TreeScreenExpandToNode !== 'function') {
        console.error('AutoUnfold: TreeScreenExpandToNode not available');
        onError?.('Tree navigation not available');
        return false;
      }

      // Use TreeScreenExpandToNode which has the improved TreeNavigation
      console.log('AutoUnfold: Using TreeScreenExpandToNode with improved path finding');
      
      // Call TreeScreenExpandToNode which has proper tree data and improved path finding
      try {
        window.TreeScreenExpandToNode(nodeId, shouldCenter);
        
        // Add visual feedback
        if (visualFeedback) {
          this.addVisualFeedback(nodeId);
        }

        // Call completion callback
        setTimeout(() => {
          onComplete?.(nodeId, true);
        }, 500);
        
        return true;
      } catch (error) {
        console.error('AutoUnfold: Failed to call TreeScreenExpandToNode:', error);
        onError?.(`Failed to unfold node: ${nodeId}`);
        return false;
      }
    },

    /**
     * Add visual feedback for the target node
     */
    addVisualFeedback: function(nodeId) {
      const element = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (element) {
        element.style.transition = 'all 0.4s ease';
        element.style.transform = 'scale(1.08)';
        element.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.6)';
        element.style.zIndex = '1000';
        element.style.border = '2px solid rgba(16, 185, 129, 0.8)';

        // Add pulse effect
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
          pulseCount++;
          element.style.boxShadow = pulseCount % 2 === 0 
            ? '0 12px 40px rgba(16, 185, 129, 0.6)'
            : '0 16px 50px rgba(16, 185, 129, 0.8)';
          
          if (pulseCount >= 4) {
            clearInterval(pulseInterval);
            setTimeout(() => {
              if (element) {
                element.style.transform = '';
                element.style.boxShadow = '';
                element.style.zIndex = '';
                element.style.border = '';
              }
            }, 800);
          }
        }, 250);
      }
    },

    /**
     * Quick unfold for search suggestions
     */
    unfoldFromSearch: function(nodeId, nodeName) {
      console.log('AutoUnfold: Unfolding from search suggestion:', nodeId, nodeName);

      return this.unfoldToNode(nodeId, {
        shouldCenter: true,
        delay: 150,
        visualFeedback: true,
        onComplete: (targetNodeId, success) => {
          console.log('AutoUnfold: Search unfold complete:', targetNodeId, success ? 'success' : 'partial');
          
          // Track the search navigation
          if (typeof window !== 'undefined' && window.UserActivityTracker) {
            window.UserActivityTracker.trackSearch(nodeName, 'navigation', 1);
            window.UserActivityTracker.trackTileOpen({ id: targetNodeId, name: nodeName });
          }
        },
        onError: (error) => {
          console.error('AutoUnfold: Search unfold failed:', error);
        }
      });
    },

    /**
     * Unfold from bookmark navigation
     */
    unfoldFromBookmark: function(nodeId, bookmarkName) {
      console.log('AutoUnfold: Unfolding from bookmark:', nodeId, bookmarkName);

      return this.unfoldToNode(nodeId, {
        shouldCenter: true,
        delay: 180,
        visualFeedback: true,
        onComplete: (targetNodeId, success) => {
          console.log('AutoUnfold: Bookmark unfold complete:', targetNodeId, success ? 'success' : 'partial');
        },
        onError: (error) => {
          console.error('AutoUnfold: Bookmark unfold failed:', error);
        }
      });
    }
  };

  console.log('✅ AutoUnfold mechanics loaded');
}
