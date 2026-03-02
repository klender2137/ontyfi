// tree.openspace.js - Standalone tree physics and interaction module
window.TreeOpenSpace = (function() {
  'use strict';

  // Generic children accessor for unified tree walking
  const getChildren = (node) => [
    ...(node.categories || []),
    ...(node.subcategories || []),
    ...(node.nodes || []),
    ...(node.subnodes || []),
    ...(node.leafnodes || [])
  ];

  // Unified walk function for tree traversal
  const walkTree = (nodes, callback, path = []) => {
    nodes.forEach((node, index) => {
      const currentPath = [...path, node];
      callback(node, currentPath, index);
      const children = getChildren(node);
      if (children.length > 0) {
        walkTree(children, callback, currentPath);
      }
    });
  };

  // Flatten tree structure using unified walk
  const flattenTree = (fields) => {
    const result = [];
    walkTree(fields, (node, path) => {
      result.push({
        ...node,
        path: path.slice(0, -1).map(n => ({ id: n.id, name: n.name }))
      });
    });
    return result;
  };

  // Physics engine for node positioning
  class TreePhysics {
    constructor() {
      this.positions = {};
      this.animationFrame = null;
    }

    calculateLayout(tree, expandedIds) {
      const positions = { ...this.positions };
      
      const positionNode = (node, x, y, level = 0, index = 0, siblingCount = 1) => {
        if (!node.id || positions[node.id]) return;
        
        if (level === 0) {
          positions[node.id] = { x: 200 + index * 300, y: 200 };
        } else {
          const angle = (index / siblingCount) * Math.PI * 2 + Math.random() * 0.3;
          const distance = 250 + level * 60;
          positions[node.id] = {
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance
          };
        }
        
        if (expandedIds.has(node.id)) {
          const children = getChildren(node);
          const pos = positions[node.id];
          children.forEach((child, i) => {
            positionNode(child, pos.x, pos.y, level + 1, i, children.length);
          });
        }
      };
      
      (tree.fields || []).forEach((field, i) => {
        positionNode(field, 0, 0, 0, i, tree.fields.length);
      });
      
      this.positions = positions;
      return positions;
    }

    updatePosition(nodeId, x, y) {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      
      this.animationFrame = requestAnimationFrame(() => {
        this.positions[nodeId] = { x, y };
        this.animationFrame = null;
      });
    }

    getPosition(nodeId) {
      return this.positions[nodeId] || { x: 0, y: 0 };
    }

    destroy() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }
  }

  // Interaction handler
  class TreeInteraction {
    constructor(physics) {
      this.physics = physics;
      this.dragInfo = null;
      this.draggedNodeId = null;
    }

    startDrag(nodeId, startX, startY) {
      const pos = this.physics.getPosition(nodeId);
      this.draggedNodeId = nodeId;
      this.dragInfo = {
        startX,
        startY,
        initialX: pos.x,
        initialY: pos.y
      };
    }

    updateDrag(currentX, currentY) {
      if (!this.draggedNodeId || !this.dragInfo) return;
      
      const deltaX = currentX - this.dragInfo.startX;
      const deltaY = currentY - this.dragInfo.startY;
      
      this.physics.updatePosition(
        this.draggedNodeId,
        this.dragInfo.initialX + deltaX,
        this.dragInfo.initialY + deltaY
      );
    }

    endDrag() {
      this.draggedNodeId = null;
      this.dragInfo = null;
    }

    isDragging() {
      return !!this.draggedNodeId;
    }
  }

  // Main TreeOpenSpace class
  class TreeOpenSpace {
    constructor() {
      this.physics = new TreePhysics();
      this.interaction = new TreeInteraction(this.physics);
    }

    flattenTree(fields) {
      return flattenTree(fields);
    }

    calculateLayout(tree, expandedIds) {
      return this.physics.calculateLayout(tree, expandedIds);
    }

    startDrag(nodeId, x, y) {
      this.interaction.startDrag(nodeId, x, y);
    }

    updateDrag(x, y) {
      this.interaction.updateDrag(x, y);
    }

    endDrag() {
      this.interaction.endDrag();
    }

    isDragging() {
      return this.interaction.isDragging();
    }

    getPosition(nodeId) {
      return this.physics.getPosition(nodeId);
    }

    walkTree(nodes, callback, path = []) {
      return walkTree(nodes, callback, path);
    }

    getChildren(node) {
      return getChildren(node);
    }
  }

  return TreeOpenSpace;
})();