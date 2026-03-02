// tree-smart-layout.js - Smart force-directed layout with grape clustering
// Uses d3-force for collision avoidance and bundled child positioning

if (typeof window !== 'undefined') {
  // Configuration for different distance-based patterns
  const LAYOUT_CONFIG = {
    tileSize: 280,
    minDistance: 320,      // Minimum distance between tiles
    parentGravity: 0.8,     // Strength of attraction to parent (grape clustering)
    collisionStrength: 0.9, // Strength of collision avoidance
    siblingRepel: 0.3,      // Gentle repulsion between siblings
    globalRepel: 0.05,      // Weak global repulsion
    damping: 0.6,           // Velocity damping for stability
    maxIterations: 150,     // Simulation iterations
    patternTypes: {
      CLUSTER: 'cluster',       // Tight grape cluster
      ARC: 'arc',               // Arc formation
      FAN: 'fan',               // Fan spread
      SPIRAL: 'spiral'          // Spiral pattern
    }
  };

  // Generate random configurational pattern for children based on count
  function getPatternForChildCount(count, distance) {
    if (count <= 2) return LAYOUT_CONFIG.patternTypes.CLUSTER;
    if (count <= 4) return LAYOUT_CONFIG.patternTypes.ARC;
    if (count <= 6) return LAYOUT_CONFIG.patternTypes.FAN;
    return LAYOUT_CONFIG.patternTypes.SPIRAL;
  }

  // Calculate target positions based on pattern
  function calculatePatternPositions(parentPos, childCount, baseDistance, pattern) {
    const positions = [];
    const variance = 0.3; // 30% random variance

    switch (pattern) {
      case LAYOUT_CONFIG.patternTypes.CLUSTER:
        // Grape cluster - tight grouping with small random variations
        for (let i = 0; i < childCount; i++) {
          const angle = (Math.PI * 2 * i) / Math.max(childCount, 1) + (Math.random() - 0.5) * 0.5;
          const dist = baseDistance * (0.8 + Math.random() * 0.4);
          positions.push({
            x: parentPos.x + Math.cos(angle) * dist,
            y: parentPos.y + Math.sin(angle) * dist,
            targetAngle: angle,
            targetDist: dist
          });
        }
        break;

      case LAYOUT_CONFIG.patternTypes.ARC:
        // Arc formation - 120-degree arc, no 180 separation
        const arcSpread = Math.PI * 0.67; // 120 degrees
        const arcStart = -arcSpread / 2 + Math.random() * 0.3; // Random rotation
        for (let i = 0; i < childCount; i++) {
          const t = childCount > 1 ? i / (childCount - 1) : 0.5;
          const angle = arcStart + t * arcSpread + (Math.random() - 0.5) * 0.2;
          const dist = baseDistance * (1 + (Math.random() - 0.5) * variance);
          positions.push({
            x: parentPos.x + Math.cos(angle) * dist,
            y: parentPos.y + Math.sin(angle) * dist,
            targetAngle: angle,
            targetDist: dist
          });
        }
        break;

      case LAYOUT_CONFIG.patternTypes.FAN:
        // Fan spread - wider but still no opposite positions
        const fanSpread = Math.PI * 0.85; // ~150 degrees max
        const fanStart = Math.random() * Math.PI * 0.3; // Random rotation
        for (let i = 0; i < childCount; i++) {
          const t = childCount > 1 ? i / (childCount - 1) : 0.5;
          const angle = fanStart + t * fanSpread + (Math.random() - 0.5) * 0.25;
          const dist = baseDistance * (0.9 + Math.random() * 0.3);
          positions.push({
            x: parentPos.x + Math.cos(angle) * dist,
            y: parentPos.y + Math.sin(angle) * dist,
            targetAngle: angle,
            targetDist: dist
          });
        }
        break;

      case LAYOUT_CONFIG.patternTypes.SPIRAL:
        // Spiral pattern - natural organic layout
        const spiralTurns = 0.75;
        for (let i = 0; i < childCount; i++) {
          const t = i / Math.max(childCount - 1, 1);
          const angle = t * Math.PI * 2 * spiralTurns + Math.random() * 0.4;
          const dist = baseDistance * (0.7 + t * 0.6 + Math.random() * 0.2);
          positions.push({
            x: parentPos.x + Math.cos(angle) * dist,
            y: parentPos.y + Math.sin(angle) * dist,
            targetAngle: angle,
            targetDist: dist
          });
        }
        break;

      default:
        // Default cluster
        for (let i = 0; i < childCount; i++) {
          const angle = (Math.PI * 2 * i) / Math.max(childCount, 1);
          const dist = baseDistance;
          positions.push({
            x: parentPos.x + Math.cos(angle) * dist,
            y: parentPos.y + Math.sin(angle) * dist,
            targetAngle: angle,
            targetDist: dist
          });
        }
    }

    return positions;
  }

  // Simple force simulation without external dependencies
  // Implements: parent gravity, collision detection, sibling repulsion
  function runForceSimulation(nodes, parentPos, iterations = 100) {
    const config = LAYOUT_CONFIG;
    const tileRadius = config.tileSize / 2;
    
    // Initialize velocities
    nodes.forEach(node => {
      node.vx = node.vx || 0;
      node.vy = node.vy || 0;
    });

    for (let iter = 0; iter < iterations; iter++) {
      // Apply forces
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let fx = 0, fy = 0;

        // 1. Parent gravity - pull toward parent (grape clustering)
        const dx = parentPos.x - node.x;
        const dy = parentPos.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetDist = node.targetDist || config.minDistance;
        
        if (dist > 0) {
          const pullStrength = config.parentGravity * (dist - targetDist) * 0.01;
          fx += (dx / dist) * pullStrength;
          fy += (dy / dist) * pullStrength;
        }

        // 2. Sibling repulsion - gentle push away from siblings
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const other = nodes[j];
          const sdx = node.x - other.x;
          const sdy = node.y - other.y;
          const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
          
          if (sdist > 0 && sdist < config.minDistance * 1.5) {
            const repelStrength = config.siblingRepel * (1 - sdist / (config.minDistance * 1.5));
            fx += (sdx / sdist) * repelStrength * 10;
            fy += (sdy / sdist) * repelStrength * 10;
          }
        }

        // 3. Target pattern attraction - pull toward ideal pattern position
        if (node.targetX !== undefined && node.targetY !== undefined) {
          const tdx = node.targetX - node.x;
          const tdy = node.targetY - node.y;
          fx += tdx * 0.02;
          fy += tdy * 0.02;
        }

        // Apply forces to velocity
        node.vx = (node.vx + fx) * config.damping;
        node.vy = (node.vy + fy) * config.damping;
      }

      // Update positions
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
      });

      // Collision resolution (post-movement)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const cdx = b.x - a.x;
          const cdy = b.y - a.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          const minDist = config.minDistance;

          if (cdist < minDist && cdist > 0) {
            const overlap = (minDist - cdist) * 0.5;
            const dx = (cdx / cdist) * overlap;
            const dy = (cdy / cdist) * overlap;
            a.x -= dx;
            a.y -= dy;
            b.x += dx;
            b.y += dy;
          }
        }
      }
    }

    return nodes;
  }

  // Check if a position collides with existing tiles
  function checkCollision(x, y, occupiedAreas, buffer = 0) {
    const tileSize = LAYOUT_CONFIG.tileSize + buffer;
    for (const area of occupiedAreas) {
      const dx = Math.abs((area.x + area.width / 2) - x);
      const dy = Math.abs((area.y + area.height / 2) - y);
      const minDist = (area.width + tileSize) / 2;
      if (dx < minDist && dy < minDist) {
        return true;
      }
    }
    return false;
  }

  // Find valid position avoiding occupied areas
  function findValidPosition(parentPos, occupiedAreas, baseDistance, maxAttempts = 50) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Try random positions in a range
      const angle = Math.random() * Math.PI * 2;
      const dist = baseDistance * (0.8 + Math.random() * 0.4);
      const x = parentPos.x + Math.cos(angle) * dist;
      const y = parentPos.y + Math.sin(angle) * dist;
      
      if (!checkCollision(x, y, occupiedAreas)) {
        return { x, y, angle, dist };
      }
    }
    
    // Fallback: expand search radius
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = baseDistance * (1.2 + Math.random() * 0.8);
      const x = parentPos.x + Math.cos(angle) * dist;
      const y = parentPos.y + Math.sin(angle) * dist;
      
      if (!checkCollision(x, y, occupiedAreas)) {
        return { x, y, angle, dist };
      }
    }
    
    // Last resort: return position with collision
    const angle = Math.random() * Math.PI * 2;
    const dist = baseDistance * 1.5;
    return {
      x: parentPos.x + Math.cos(angle) * dist,
      y: parentPos.y + Math.sin(angle) * dist,
      angle,
      dist
    };
  }

  // Build occupied areas map from existing positions
  function buildOccupiedAreas(allPositions, expandedIds = new Set()) {
    const occupied = [];
    Object.entries(allPositions).forEach(([nodeId, pos]) => {
      occupied.push({
        x: pos.x - LAYOUT_CONFIG.tileSize / 2,
        y: pos.y - LAYOUT_CONFIG.tileSize / 2,
        width: LAYOUT_CONFIG.tileSize,
        height: LAYOUT_CONFIG.tileSize,
        nodeId
      });
    });
    return occupied;
  }

  // Main smart layout function
  window.TreeSmartLayout = {
    config: LAYOUT_CONFIG,

    /**
     * Calculate smart positions for children of a parent node
     * Uses force-directed simulation with pattern-based initial placement
     */
    calculateChildPositions: (parentPos, children, allPositions, expandedIds) => {
      if (!children || children.length === 0) return {};
      
      const occupiedAreas = buildOccupiedAreas(allPositions, expandedIds);
      const baseDistance = LAYOUT_CONFIG.minDistance;
      const pattern = getPatternForChildCount(children.length, baseDistance);
      
      // Get pattern-based initial positions
      const patternPositions = calculatePatternPositions(parentPos, children.length, baseDistance, pattern);
      
      // Create simulation nodes
      const nodes = children.map((child, i) => ({
        id: child.id,
        x: patternPositions[i].x,
        y: patternPositions[i].y,
        targetX: patternPositions[i].x,
        targetY: patternPositions[i].y,
        targetDist: patternPositions[i].targetDist,
        targetAngle: patternPositions[i].targetAngle,
        child: child
      }));

      // Filter out nodes that would collide with existing tiles
      const validNodes = nodes.filter(node => {
        return !checkCollision(node.x, node.y, occupiedAreas, 20);
      });

      // If too many collisions, find alternative positions
      nodes.forEach((node, i) => {
        if (checkCollision(node.x, node.y, occupiedAreas, 20)) {
          const valid = findValidPosition(parentPos, occupiedAreas, baseDistance);
          node.x = valid.x;
          node.y = valid.y;
          node.targetX = valid.x;
          node.targetY = valid.y;
          node.targetDist = valid.dist;
          node.targetAngle = valid.angle;
        }
      });

      // Run force simulation to resolve collisions and create grape clustering
      const simulatedNodes = runForceSimulation(nodes, parentPos, LAYOUT_CONFIG.maxIterations);
      
      // Convert back to positions object
      const positions = {};
      simulatedNodes.forEach(node => {
        positions[node.id] = {
          x: node.x,
          y: node.y,
          pattern: pattern,
          distance: Math.sqrt(
            Math.pow(node.x - parentPos.x, 2) + 
            Math.pow(node.y - parentPos.y, 2)
          )
        };
      });

      return positions;
    },

    /**
     * Alternative to findEmptySpace - returns sectors with smart positioning
     * Maintains compatibility with existing code
     */
    findEmptySpace: (parentPos, allPositions, childCount, expandedIds, getChildren, tree) => {
      const occupied = buildOccupiedAreas(allPositions, expandedIds);
      const baseDistance = LAYOUT_CONFIG.minDistance;
      const pattern = getPatternForChildCount(childCount, baseDistance);
      const patternPositions = calculatePatternPositions(parentPos, childCount, baseDistance, pattern);
      
      // Convert to sector format for compatibility
      return patternPositions.map(pos => ({
        angle: pos.targetAngle,
        space: pos.targetDist,
        hasValidPosition: !checkCollision(pos.x, pos.y, occupied, 30),
        x: pos.x,
        y: pos.y,
        pattern: pattern
      })).sort((a, b) => {
        // Prioritize valid positions, then by distance variance for interest
        if (a.hasValidPosition && !b.hasValidPosition) return -1;
        if (!a.hasValidPosition && b.hasValidPosition) return 1;
        return Math.random() - 0.5; // Randomize within valid positions
      });
    },

    /**
     * Calculate full tree positions with smart layout
     */
    calculatePositions: (tree, expandedIds, getChildren, currentPositions = {}) => {
      const positions = { ...currentPositions };
      const centerX = 2500, centerY = 2500;

      const calculateLayout = (nodes, level = 0, parentPos = null, parentId = null) => {
        if (!nodes || !Array.isArray(nodes)) return;

        nodes.forEach((node, index) => {
          if (!node || !node.id) return;

          if (!positions[node.id]) {
            let newPos;
            if (parentPos && level > 0) {
              // Use smart layout for children
              const siblings = nodes;
              const siblingPositions = window.TreeSmartLayout.calculateChildPositions(
                parentPos,
                siblings,
                positions,
                expandedIds
              );
              newPos = siblingPositions[node.id] || {
                x: parentPos.x + (Math.random() - 0.5) * 400,
                y: parentPos.y + (Math.random() - 0.5) * 400
              };
            } else {
              // Root level - circular layout
              const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
              const radius = 400 + (nodes.length * 40);
              newPos = {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
              };
            }
            positions[node.id] = newPos;
          }

          // Recursively layout children if expanded
          if (expandedIds.has(node.id)) {
            const children = getChildren(node);
            if (children.length > 0) {
              calculateLayout(children, level + 1, positions[node.id], node.id);
            }
          }
        });
      };

      calculateLayout(tree.fields);
      return positions;
    },

    /**
     * Update positions for children when a node is expanded
     */
    updateChildrenPositions: (parentId, parentPos, expandedIds, getChildren, tree, currentPositions) => {
      const positions = { ...currentPositions };
      
      // Find the parent node
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
      if (children.length === 0) return positions;

      // Use smart layout
      const childPositions = window.TreeSmartLayout.calculateChildPositions(
        parentPos,
        children,
        positions,
        expandedIds
      );

      // Merge positions
      Object.assign(positions, childPositions);

      return positions;
    }
  };

  console.log('✅ TreeSmartLayout loaded with grape clustering');
}
