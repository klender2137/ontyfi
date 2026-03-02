// tree-navigation.js - Navigation and expansion logic
if (typeof window !== 'undefined') {
  window.TreeNavigation = {
    createCenterOnNode: (nodePositions, zoom, panOffset, setViewState, containerRef) => {
      return (nodeId) => {
        console.log('TreeNavigation: centerOnNode called for:', nodeId);
        const positionsObj = (nodePositions && nodePositions.current) ? nodePositions.current : nodePositions;
        const zoomValue = (zoom && zoom.current !== undefined) ? zoom.current : zoom;
        const panValue = (panOffset && panOffset.current) ? panOffset.current : panOffset;
        const nodePos = positionsObj ? positionsObj[nodeId] : null;
        if (!nodePos) {
          console.warn('TreeNavigation: Node position not found for:', nodeId);
          return;
        }
        if (!containerRef.current) {
          console.warn('TreeNavigation: Container ref not available');
          return;
        }
        const containerRect = containerRef.current.getBoundingClientRect();
        const viewportCenterX = containerRect.width / 2, viewportCenterY = containerRect.height / 2;
        const newPanX = viewportCenterX - (nodePos.x * zoomValue), newPanY = viewportCenterY - (nodePos.y * zoomValue);
        const startPanX = (panValue && panValue.x !== undefined) ? panValue.x : 0;
        const startPanY = (panValue && panValue.y !== undefined) ? panValue.y : 0;
        const duration = 800, startTime = Date.now();
        const animateCenter = () => {
          const elapsed = Date.now() - startTime, progress = Math.min(elapsed / duration, 1);
          const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
          const easedProgress = easeInOutCubic(progress);
          const currentPanX = startPanX + (newPanX - startPanX) * easedProgress;
          const currentPanY = startPanY + (newPanY - startPanY) * easedProgress;
          setViewState(prev => ({ ...prev, panOffset: { x: currentPanX, y: currentPanY } }));
          if (progress < 1) requestAnimationFrame(animateCenter);
        };
        requestAnimationFrame(animateCenter);
      };
    },

    createExpandToNode: (tree, setExpandedIds, centerOnNode, getChildren, setTreeVersion) => {
      return (nodeId, shouldCenter = false) => {
        console.log('TreeNavigation: expandToNode called with:', { nodeId, shouldCenter });
        if (!tree || !tree.fields || !nodeId) {
          console.warn('TreeNavigation: Invalid parameters');
          return;
        }

        const centerWhenReady = (targetId, maxAttempts = 10, attemptDelay = 120) => {
          let attempt = 0;
          const tryCenter = () => {
            attempt++;
            try {
              centerOnNode(targetId);
              const el = document.querySelector(`[data-node-id="${targetId}"]`);
              if (el) return;
            } catch (e) {
              // ignore and retry
            }
            if (attempt < maxAttempts) {
              setTimeout(tryCenter, attemptDelay);
            }
          };
          tryCenter();
        };
        
        // Enhanced findPath that handles all node types in the hierarchy
        const findPath = (nodes, targetId, path = []) => {
          if (!Array.isArray(nodes)) return null;
          for (const node of nodes) {
            if (!node || !node.id) continue;
            const currentPath = [...path, node.id]; // Use node.id for path expansion, not node.name
            if (node.id === targetId) {
              console.log('TreeNavigation: Found path:', currentPath);
              return currentPath;
            }
            
            // Check all possible child containers
            const childContainers = [
              node.subnodes,
              node.leafnodes,
              node.categories,
              node.subcategories,
              node.nodes
            ];
            
            for (const container of childContainers) {
              if (container && Array.isArray(container)) {
                const found = findPath(container, targetId, currentPath);
                if (found) return found;
              }
            }
          }
          return null;
        };
        
        const path = findPath(tree.fields, nodeId);
        if (!path) {
          console.warn('TreeNavigation: Path not found for:', nodeId);
          if (shouldCenter) {
            // Wait a bit for tree to render, then try to center
            setTimeout(() => {
              centerWhenReady(nodeId);
              // Add visual feedback even if path not found
              const targetElement = document.querySelector(`[data-node-id="${nodeId}"]`);
              if (targetElement) {
                targetElement.style.transition = 'all 0.3s ease';
                targetElement.style.transform = 'scale(1.05)';
                targetElement.style.boxShadow = '0 8px 30px rgba(239, 68, 68, 0.4)';
                setTimeout(() => {
                  targetElement.style.transform = '';
                  targetElement.style.boxShadow = '';
                }, 1000);
              }
            }, 300);
          }
          return;
        }
        
        if (path.length > 0) {
          const expandPath = path.length > 1 ? path.slice(0, -1) : [];
          console.log('TreeNavigation: Expanding path:', expandPath);
          
          if (expandPath.length > 0) {
            let currentIndex = 0;
            const baseDelay = 150; // Increased delay for better reliability
            const expandInterval = setInterval(() => {
              if (currentIndex >= expandPath.length) {
                clearInterval(expandInterval);
                console.log('TreeNavigation: Expansion complete');
                
                if (shouldCenter) {
                  // Wait longer for positions to update after expansion
                  const totalExpansionDelay = Math.max(800, expandPath.length * baseDelay + 200);
                  setTimeout(() => {
                    console.log('TreeNavigation: Centering on:', nodeId);
                    centerWhenReady(nodeId);
                    
                    // Enhanced visual feedback
                    const targetElement = document.querySelector(`[data-node-id="${nodeId}"]`);
                    if (targetElement) {
                      targetElement.style.transition = 'all 0.3s ease';
                      targetElement.style.transform = 'scale(1.08)';
                      targetElement.style.boxShadow = '0 12px 40px rgba(56, 189, 248, 0.6)';
                      targetElement.style.zIndex = '1000';
                      
                      // Add pulse effect
                      let pulseCount = 0;
                      const pulseInterval = setInterval(() => {
                        pulseCount++;
                        targetElement.style.boxShadow = pulseCount % 2 === 0 
                          ? '0 12px 40px rgba(56, 189, 248, 0.6)'
                          : '0 16px 50px rgba(56, 189, 248, 0.8)';
                        
                        if (pulseCount >= 4) {
                          clearInterval(pulseInterval);
                          setTimeout(() => {
                            if (targetElement) {
                              targetElement.style.transform = '';
                              targetElement.style.boxShadow = '';
                              targetElement.style.zIndex = '';
                            }
                          }, 500);
                        }
                      }, 200);
                    }
                  }, totalExpansionDelay);
                }
                return;
              }
              
              const nodeIdToExpand = expandPath[currentIndex];
              console.log('TreeNavigation: Expanding node:', nodeIdToExpand, `(${currentIndex + 1}/${expandPath.length})`);
              
              setExpandedIds(prev => {
                if (prev.has(nodeIdToExpand)) {
                  console.log('TreeNavigation: Node already expanded:', nodeIdToExpand);
                  return prev;
                }
                const newExpanded = new Set(prev);
                newExpanded.add(nodeIdToExpand);
                console.log('TreeNavigation: Added to expanded set:', nodeIdToExpand);
                return newExpanded;
              });

              // Re-seed child positions for organic randomness (similar to manual expansion)
              if (typeof window !== 'undefined' && typeof window.TreeScreenReseedChildren === 'function') {
                setTimeout(() => {
                  try {
                    window.TreeScreenReseedChildren(nodeIdToExpand);
                  } catch (e) {
                    // non-blocking
                  }
                }, 0);
              }
              
              // Trigger position recalculation
              setTreeVersion(v => {
                const newVersion = v + 1;
                console.log('TreeNavigation: Tree version updated to:', newVersion);
                return newVersion;
              });
              
              currentIndex++;
            }, baseDelay);
          } else if (shouldCenter) {
            // Node is at root level, just center
            setTimeout(() => {
              centerWhenReady(nodeId);
              const targetElement = document.querySelector(`[data-node-id="${nodeId}"]`);
              if (targetElement) {
                targetElement.style.transition = 'all 0.3s ease';
                targetElement.style.transform = 'scale(1.05)';
                targetElement.style.boxShadow = '0 8px 30px rgba(56, 189, 248, 0.4)';
                setTimeout(() => {
                  targetElement.style.transform = '';
                  targetElement.style.boxShadow = '';
                }, 1000);
              }
            }, 200);
          }
        }
      };
    }
  };
}
