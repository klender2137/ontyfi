// tree-layout.js - Intelligent layout with collision avoidance
if (typeof window !== 'undefined') {
  // Helper function to find a node in the tree structure
  const findNodeInTree = (tree, nodeId) => {
    if (!tree || !tree.fields) return null;
    
    const searchInNodes = (nodes) => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        
        // Search in subnodes
        if (node.subnodes) {
          const found = searchInNodes(node.subnodes);
          if (found) return found;
        }
        
        // Search in subcategories
        if (node.subcategories) {
          const found = searchInNodes(node.subcategories);
          if (found) return found;
        }
        
        // Search in categories
        if (node.categories) {
          const found = searchInNodes(node.categories);
          if (found) return found;
        }
        
        // Search in leafnodes
        if (node.leafnodes) {
          const found = searchInNodes(node.leafnodes);
          if (found) return found;
        }
      }
      return null;
    };
    
    return searchInNodes(tree.fields);
  };
  
  window.TreeLayout = {
    findEmptySpace: (parentPos, allPositions, childCount, expandedIds = new Set(), getChildren = null, tree = null) => {
      const tileSize = 280;
      const minDistance = 300;
      const expandedTileSize = 400; // Larger area for expanded tiles with children
      const sectors = [];
      
      // Create occupied areas map including expanded tiles and their children
      let occupiedAreas = [];
      
      // Add regular tile positions
      Object.entries(allPositions).forEach(([nodeId, pos]) => {
        const size = expandedIds.has(nodeId) ? expandedTileSize : tileSize;
        occupiedAreas.push({
          x: pos.x,
          y: pos.y,
          width: size,
          height: size,
          nodeId: nodeId,
          isExpanded: expandedIds.has(nodeId)
        });
      });
      
      // If we have getChildren and tree, add estimated child positions for expanded tiles
      if (getChildren && tree) {
        expandedIds.forEach(parentId => {
          const parentNode = findNodeInTree(tree, parentId);
          if (parentNode && allPositions[parentId]) {
            const children = getChildren(parentNode);
            const parentPos = allPositions[parentId];
            
            // Estimate child positions around parent
            children.forEach((child, index) => {
              const angle = (index / Math.max(children.length, 1)) * Math.PI * 2;
              const estimatedDist = 350; // Typical distance for children
              const childX = parentPos.x + Math.cos(angle) * estimatedDist - tileSize/2;
              const childY = parentPos.y + Math.sin(angle) * estimatedDist - tileSize/2;
              
              occupiedAreas.push({
                x: childX,
                y: childY,
                width: tileSize,
                height: tileSize,
                nodeId: child.id,
                isChildOfExpanded: true,
                parentId: parentId
              });
            });
          }
        });
      }
      
      // Enhanced collision detection function
      const hasCollisionWithOccupiedAreas = (testX, testY, testSize = tileSize) => {
        return occupiedAreas.some(area => {
          // Check rectangular collision
          const collision = !(
            testX + testSize < area.x ||
            testX > area.x + area.width ||
            testY + testSize < area.y ||
            testY > area.y + area.height
          );
          
          // Also check minimum distance from expanded tiles and their children
          if (!collision && (area.isExpanded || area.isChildOfExpanded)) {
            const dx = (area.x + area.width/2) - (testX + testSize/2);
            const dy = (area.y + area.height/2) - (testY + testSize/2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < minDistance;
          }
          
          return collision;
        });
      };
      
      // Use more sectors for better randomness
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) { // 24 sectors instead of 16
        let maxDist = minDistance;
        let foundValidPosition = false;
        
        for (let dist = minDistance; dist < 1200; dist += 50) {
          const testX = parentPos.x + Math.cos(angle) * dist - tileSize/2;
          const testY = parentPos.y + Math.sin(angle) * dist - tileSize/2;
          
          if (!hasCollisionWithOccupiedAreas(testX, testY)) {
            maxDist = dist;
            foundValidPosition = true;
          } else if (foundValidPosition) {
            // We found a valid position before but now hit collision, stop searching this direction
            break;
          }
        }
        
        sectors.push({ angle, space: maxDist, hasValidPosition: foundValidPosition });
      }
      
      // Sort by space and prioritize sectors with valid positions
      sectors.sort((a, b) => {
        if (a.hasValidPosition && !b.hasValidPosition) return -1;
        if (!a.hasValidPosition && b.hasValidPosition) return 1;
        return b.space - a.space;
      });
      
      // Shuffle top sectors to add randomness (only those with valid positions)
      const validSectors = sectors.filter(s => s.hasValidPosition);
      const topSectors = validSectors.slice(0, Math.min(childCount * 3, validSectors.length));
      
      for (let i = topSectors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [topSectors[i], topSectors[j]] = [topSectors[j], topSectors[i]];
      }
      
      return topSectors.slice(0, childCount);
    },

    // Function to get all occupied areas including children of expanded tiles
    getAllOccupiedAreas: (allPositions, expandedIds, getChildren, tree) => {
      const tileSize = 280;
      const expandedTileSize = 400;
      const occupiedAreas = [];
      
      // Add all direct tile positions
      Object.entries(allPositions).forEach(([nodeId, pos]) => {
        const size = expandedIds.has(nodeId) ? expandedTileSize : tileSize;
        occupiedAreas.push({
          x: pos.x,
          y: pos.y,
          width: size,
          height: size,
          nodeId: nodeId,
          isExpanded: expandedIds.has(nodeId)
        });
      });
      
      // Add children positions for expanded tiles (they might not be in allPositions yet)
      expandedIds.forEach(parentId => {
        const parentNode = findNodeInTree(tree, parentId);
        if (parentNode && allPositions[parentId]) {
          const children = getChildren(parentNode);
          const parentPos = allPositions[parentId];
          
          // Estimate child positions around parent
          children.forEach((child, index) => {
            const angle = (index / Math.max(children.length, 1)) * Math.PI * 2;
            const estimatedDist = 350; // Typical distance for children
            const childX = parentPos.x + Math.cos(angle) * estimatedDist - tileSize/2;
            const childY = parentPos.y + Math.sin(angle) * estimatedDist - tileSize/2;
            
            occupiedAreas.push({
              x: childX,
              y: childY,
              width: tileSize,
              height: tileSize,
              nodeId: child.id,
              isChildOfExpanded: true,
              parentId: parentId
            });
          });
        }
      });
      
      return occupiedAreas;
    },

    calculatePositions: (tree, expandedIds, getChildren, currentPositions = {}) => {
      const positions = { ...currentPositions };
      const centerX = 2500, centerY = 2500;
      const calculateLayout = (nodes, level = 0, parentPos = null) => {
        if (!nodes || !Array.isArray(nodes)) return;
        nodes.forEach((node, index) => {
          if (!node || !node.id) return;
          if (!positions[node.id]) {
            let newPos;
            if (parentPos && level > 0) {
              const sectors = window.TreeLayout.findEmptySpace(parentPos, positions, nodes.length, expandedIds, getChildren, tree);
              const sector = sectors[index % sectors.length];
              newPos = { x: parentPos.x + Math.cos(sector.angle) * sector.space, y: parentPos.y + Math.sin(sector.angle) * sector.space };
            } else {
              const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
              const radius = 300 + (nodes.length * 30);
              newPos = { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
            }
            positions[node.id] = newPos;
          }
          if (expandedIds.has(node.id)) {
            const children = getChildren(node);
            calculateLayout(children, level + 1, positions[node.id]);
          }
        });
      };
      calculateLayout(tree.fields);
      return positions;
    },

    updateChildrenPositions: (parentId, parentPos, expandedIds, getChildren, tree, currentPositions) => {
      const positions = { ...currentPositions };
      const findNode = (nodes, targetId) => {
        for (const node of nodes) {
          if (node.id === targetId) return node;
          const children = getChildren(node);
          const found = findNode(children, targetId);
          if (found) return found;
        }
        return null;
      };
      const parentNode = findNode(tree.fields, parentId);
      if (!parentNode || !expandedIds.has(parentId)) return positions;
      const children = getChildren(parentNode);
      const sectors = window.TreeLayout.findEmptySpace(parentPos, positions, children.length);
      children.forEach((child, index) => {
        const sector = sectors[index % sectors.length];
        positions[child.id] = { x: parentPos.x + Math.cos(sector.angle) * sector.space, y: parentPos.y + Math.sin(sector.angle) * sector.space };
      });
      return positions;
    },

    collapseDescendants: (nodeId, expanded, tree, getChildren) => {
      const toCollapse = new Set();
      const findDescendants = (nodes) => {
        nodes.forEach(node => {
          if (expanded.has(node.id)) {
            toCollapse.add(node.id);
            const children = getChildren(node);
            if (children.length > 0) findDescendants(children);
          }
        });
      };
      const findNodeInTree = (nodes, targetId) => {
        for (const node of nodes) {
          if (node.id === targetId) return node;
          const children = getChildren(node);
          const found = findNodeInTree(children, targetId);
          if (found) return found;
        }
        return null;
      };
      const targetNode = findNodeInTree(tree.fields, nodeId);
      if (targetNode) {
        const children = getChildren(targetNode);
        findDescendants(children);
      }
      return toCollapse;
    }
  };
}
