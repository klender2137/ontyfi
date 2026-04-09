import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Spatial Hash Map (OccupancyMap) for efficient collision detection
 * Maps tile coordinates to grid cells for O(1) collision lookups
 */
class OccupancyMap {
  constructor(cellSize = 50) {
    this.cellSize = cellSize;
    this.map = new Map();
    this.tileRegistry = new Map(); // Stores full tile data by ID
  }

  // Get cell key for a coordinate
  _getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  // Register a tile in the occupancy map
  registerTile(tileId, rect, branchId = null) {
    const { x, y, width, height } = rect;
    
    // Store tile data
    this.tileRegistry.set(tileId, {
      id: tileId,
      x, y, width, height,
      branchId,
      centerX: x + width / 2,
      centerY: y + height / 2
    });

    // Register in all overlapping cells
    const startCellX = Math.floor(x / this.cellSize);
    const endCellX = Math.floor((x + width) / this.cellSize);
    const startCellY = Math.floor(y / this.cellSize);
    const endCellY = Math.floor((y + height) / this.cellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx},${cy}`;
        if (!this.map.has(key)) {
          this.map.set(key, new Set());
        }
        this.map.get(key).add(tileId);
      }
    }
  }

  // Unregister a tile
  unregisterTile(tileId) {
    const tile = this.tileRegistry.get(tileId);
    if (!tile) return;

    const { x, y, width, height } = tile;
    const startCellX = Math.floor(x / this.cellSize);
    const endCellX = Math.floor((x + width) / this.cellSize);
    const startCellY = Math.floor(y / this.cellSize);
    const endCellY = Math.floor((y + height) / this.cellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.map.get(key);
        if (cell) {
          cell.delete(tileId);
          if (cell.size === 0) {
            this.map.delete(key);
          }
        }
      }
    }

    this.tileRegistry.delete(tileId);
  }

  // Check if a rectangular area is clear (no collisions)
  isAreaClear(rect, excludeTileId = null, safetyBuffer = 0) {
    const { x, y, width, height } = rect;
    const bufferedRect = {
      x: x - safetyBuffer,
      y: y - safetyBuffer,
      width: width + safetyBuffer * 2,
      height: height + safetyBuffer * 2
    };

    const startCellX = Math.floor(bufferedRect.x / this.cellSize);
    const endCellX = Math.floor((bufferedRect.x + bufferedRect.width) / this.cellSize);
    const startCellY = Math.floor(bufferedRect.y / this.cellSize);
    const endCellY = Math.floor((bufferedRect.y + bufferedRect.height) / this.cellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.map.get(key);
        if (cell) {
          for (const tileId of cell) {
            if (tileId === excludeTileId) continue;
            const tile = this.tileRegistry.get(tileId);
            if (tile && this._rectsIntersect(bufferedRect, tile)) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  // Get all tiles within a radius (for repulsion)
  getNearbyTiles(x, y, radius) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${centerCellX + dx},${centerCellY + dy}`;
        const cell = this.map.get(key);
        if (cell) {
          for (const tileId of cell) {
            const tile = this.tileRegistry.get(tileId);
            if (tile) {
              const dist = Math.hypot(tile.centerX - x, tile.centerY - y);
              if (dist <= radius) {
                nearby.push({ ...tile, distance: dist });
              }
            }
          }
        }
      }
    }
    return nearby;
  }

  // Check if two rectangles intersect
  _rectsIntersect(a, b) {
    return !(a.x + a.width < b.x || 
             b.x + b.width < a.x || 
             a.y + a.height < b.y || 
             b.y + b.height < a.y);
  }

  // Get all registered tiles
  getAllTiles() {
    return Array.from(this.tileRegistry.values());
  }

  // Clear all data
  clear() {
    this.map.clear();
    this.tileRegistry.clear();
  }

  // Get bounding box for a branch
  getBranchBoundingBox(branchId) {
    const branchTiles = this.getAllTiles().filter(t => t.branchId === branchId);
    if (branchTiles.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const tile of branchTiles) {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + tile.width);
      maxY = Math.max(maxY, tile.y + tile.height);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

/**
 * Poisson Disc Sampling for even tile distribution
 * Ensures minimum distance between spawn points
 */
class PoissonDiscSampler {
  constructor(minRadius = 150, maxAttempts = 30) {
    this.minRadius = minRadius;
    this.maxAttempts = maxAttempts;
  }

  /**
   * Generate a candidate position around a parent point
   * Uses annulus sampling (distance between minRadius and 2*minRadius)
   */
  generateCandidate(parentX, parentY, occupancyMap, tileWidth, tileHeight, branchId = null) {
    for (let i = 0; i < this.maxAttempts; i++) {
      // Random angle
      const angle = Math.random() * Math.PI * 2;
      // Random distance in annulus [minRadius, 2*minRadius]
      const distance = this.minRadius + Math.random() * this.minRadius;
      
      const x = parentX + Math.cos(angle) * distance - tileWidth / 2;
      const y = parentY + Math.sin(angle) * distance - tileHeight / 2;

      const candidate = { x, y, width: tileWidth, height: tileHeight };

      // Check if position is clear (with safety buffer)
      if (occupancyMap.isAreaClear(candidate, null, this.minRadius * 0.3)) {
        return { ...candidate, angle, distance, branchId };
      }
    }
    return null;
  }

  /**
   * Smart Pivot Search - when normal sampling fails, search in circular pattern
   * Tests positions at different angles until finding a clear spot
   */
  pivotSearch(parentX, parentY, occupancyMap, tileWidth, tileHeight, branchId = null) {
    const pivotAngles = [45, 90, 135, 180, 225, 270, 315, 0]; // Degrees
    const distances = [1.5, 2, 2.5, 3]; // Multipliers of minRadius

    for (const distMult of distances) {
      for (const angleDeg of pivotAngles) {
        const angle = (angleDeg * Math.PI) / 180;
        const distance = this.minRadius * distMult;
        
        const x = parentX + Math.cos(angle) * distance - tileWidth / 2;
        const y = parentY + Math.sin(angle) * distance - tileHeight / 2;

        const candidate = { x, y, width: tileWidth, height: tileHeight };

        if (occupancyMap.isAreaClear(candidate, null, this.minRadius * 0.3)) {
          return { 
            ...candidate, 
            angle, 
            distance, 
            branchId,
            pivotAngle: angleDeg,
            pivotDistance: distMult 
          };
        }
      }
    }
    return null;
  }
}

/**
 * Repulsion Force Physics System
 * Applies forces to push overlapping tiles apart
 */
class RepulsionPhysics {
  constructor(repulsionStrength = 2.0, damping = 0.85, minDistance = 120) {
    this.repulsionStrength = repulsionStrength;
    this.damping = damping;
    this.minDistance = minDistance;
    this.velocities = new Map(); // tileId -> {vx, vy}
  }

  /**
   * Calculate repulsion forces between all tiles
   * Returns new positions after applying physics
   */
  applyForces(occupancyMap, iterations = 3) {
    const tiles = occupancyMap.getAllTiles();
    const newPositions = new Map();

    // Initialize velocities if not exists
    for (const tile of tiles) {
      if (!this.velocities.has(tile.id)) {
        this.velocities.set(tile.id, { vx: 0, vy: 0 });
      }
    }

    // Run multiple iterations for stability
    for (let iter = 0; iter < iterations; iter++) {
      for (const tile of tiles) {
        let fx = 0, fy = 0;
        const velocity = this.velocities.get(tile.id);

        // Get nearby tiles within repulsion range
        const nearby = occupancyMap.getNearbyTiles(
          tile.centerX, 
          tile.centerY, 
          this.minDistance * 2
        );

        for (const other of nearby) {
          if (other.id === tile.id) continue;

          const dx = tile.centerX - other.centerX;
          const dy = tile.centerY - other.centerY;
          const dist = Math.hypot(dx, dy);

          if (dist < this.minDistance && dist > 0) {
            // Repulsion force inversely proportional to distance
            const force = this.repulsionStrength * (this.minDistance - dist) / this.minDistance;
            const nx = dx / dist;
            const ny = dy / dist;
            
            fx += nx * force;
            fy += ny * force;
          }
        }

        // Apply force to velocity
        velocity.vx = (velocity.vx + fx) * this.damping;
        velocity.vy = (velocity.vy + fy) * this.damping;

        // Calculate new position
        const newX = tile.x + velocity.vx;
        const newY = tile.y + velocity.vy;

        newPositions.set(tile.id, {
          x: newX,
          y: newY,
          width: tile.width,
          height: tile.height,
          centerX: newX + tile.width / 2,
          centerY: newY + tile.height / 2,
          branchId: tile.branchId
        });
      }
    }

    return newPositions;
  }

  // Clear velocities for a tile
  clearVelocity(tileId) {
    this.velocities.delete(tileId);
  }

  // Clear all velocities
  clearAll() {
    this.velocities.clear();
  }
}

/**
 * Branch-Aware Boundary System
 * Manages bounding boxes for branches with safety buffers
 */
class BranchBoundaryManager {
  constructor(safetyBufferMultiplier = 1.5) {
    this.safetyBufferMultiplier = safetyBufferMultiplier;
    this.branchBoxes = new Map();
  }

  /**
   * Calculate and store bounding box for a branch
   */
  updateBranchBoundary(branchId, occupancyMap) {
    const bbox = occupancyMap.getBranchBoundingBox(branchId);
    if (bbox) {
      // Add safety buffer
      const bufferX = bbox.width * (this.safetyBufferMultiplier - 1) / 2;
      const bufferY = bbox.height * (this.safetyBufferMultiplier - 1) / 2;
      
      this.branchBoxes.set(branchId, {
        x: bbox.x - bufferX,
        y: bbox.y - bufferY,
        width: bbox.width + bufferX * 2,
        height: bbox.height + bufferY * 2,
        original: bbox
      });
    }
  }

  /**
   * Check if a proposed position would collide with other branch boundaries
   */
  wouldCollideWithOtherBranches(rect, branchId, occupancyMap) {
    const bufferedRect = {
      x: rect.x - rect.width * (this.safetyBufferMultiplier - 1) / 2,
      y: rect.y - rect.height * (this.safetyBufferMultiplier - 1) / 2,
      width: rect.width * this.safetyBufferMultiplier,
      height: rect.height * this.safetyBufferMultiplier
    };

    for (const [otherBranchId, box] of this.branchBoxes) {
      if (otherBranchId === branchId) continue;
      
      if (this._rectsIntersect(bufferedRect, box)) {
        return {
          collides: true,
          withBranch: otherBranchId,
          suggestedPivot: this._calculatePivotDirection(rect, box)
        };
      }
    }

    return { collides: false };
  }

  /**
   * Calculate pivot direction to avoid collision
   */
  _calculatePivotDirection(rect, otherBox) {
    const dx = (rect.x + rect.width/2) - (otherBox.x + otherBox.width/2);
    const dy = (rect.y + rect.height/2) - (otherBox.y + otherBox.height/2);
    
    // Return angle in degrees
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Snap to nearest 45 or 90 degree increment
    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    return snapAngles.reduce((prev, curr) => 
      Math.abs(curr - normalizedAngle) < Math.abs(prev - normalizedAngle) ? curr : prev
    );
  }

  _rectsIntersect(a, b) {
    return !(a.x + a.width < b.x || 
             b.x + b.width < a.x || 
             a.y + a.height < b.y || 
             b.y + b.height < a.y);
  }

  clear() {
    this.branchBoxes.clear();
  }
}

/**
 * Main Hook: useTilePositioning
 * Combines all anti-clutter systems
 */
export function useTilePositioning(options = {}) {
  const {
    minTileDistance = 150,
    safetyBuffer = 1.5,
    repulsionStrength = 2.0,
    enablePhysics = true,
    enablePoissonDisc = true,
    enableBranchBoundaries = true
  } = options;

  // System refs
  const occupancyMap = useRef(new OccupancyMap(minTileDistance / 2));
  const poissonSampler = useRef(new PoissonDiscSampler(minTileDistance));
  const physics = useRef(new RepulsionPhysics(repulsionStrength, 0.85, minTileDistance));
  const boundaryManager = useRef(new BranchBoundaryManager(safetyBuffer));
  
  // Track positioned tiles
  const [tilePositions, setTilePositions] = useState({});
  const positionedTiles = useRef(new Set());

  /**
   * Calculate spawn position for a new tile
   * Uses Poisson Disc + Smart Pivot + Branch Boundary checks
   */
  const calculateSpawnPosition = useCallback((parentId, tileId, tileWidth, tileHeight, branchId = null) => {
    // Get parent position if exists
    const parentPos = tilePositions[parentId];
    const parentCenterX = parentPos ? parentPos.x + tileWidth / 2 : window.innerWidth / 2;
    const parentCenterY = parentPos ? parentPos.y + tileHeight / 2 : window.innerHeight / 2;

    let candidate = null;

    // Try Poisson Disc Sampling first
    if (enablePoissonDisc) {
      candidate = poissonSampler.current.generateCandidate(
        parentCenterX, 
        parentCenterY,
        occupancyMap.current,
        tileWidth,
        tileHeight,
        branchId
      );
    }

    // If blocked, try Smart Pivot Search
    if (!candidate && enablePoissonDisc) {
      candidate = poissonSampler.current.pivotSearch(
        parentCenterX,
        parentCenterY,
        occupancyMap.current,
        tileWidth,
        tileHeight,
        branchId
      );
    }

    // Check branch boundary collisions
    if (candidate && enableBranchBoundaries && branchId) {
      const collision = boundaryManager.current.wouldCollideWithOtherBranches(
        candidate,
        branchId,
        occupancyMap.current
      );

      if (collision.collides) {
        // Try pivoting 90 degrees from collision direction
        const pivotAngle = (collision.suggestedPivot + 90) % 360;
        const distance = minTileDistance * 2;
        const rad = (pivotAngle * Math.PI) / 180;
        
        candidate = {
          x: parentCenterX + Math.cos(rad) * distance - tileWidth / 2,
          y: parentCenterY + Math.sin(rad) * distance - tileHeight / 2,
          width: tileWidth,
          height: tileHeight,
          branchId,
          pivotAngle,
          pivoted: true
        };
      }
    }

    // Fallback: random position with minimum distance check
    if (!candidate) {
      let attempts = 0;
      while (attempts < 50) {
        const angle = Math.random() * Math.PI * 2;
        const distance = minTileDistance * (2 + attempts * 0.1);
        
        candidate = {
          x: parentCenterX + Math.cos(angle) * distance - tileWidth / 2,
          y: parentCenterY + Math.sin(angle) * distance - tileHeight / 2,
          width: tileWidth,
          height: tileHeight,
          branchId,
          fallback: true
        };

        if (occupancyMap.current.isAreaClear(candidate, null, minTileDistance * 0.3)) {
          break;
        }
        attempts++;
      }
    }

    // Final fallback: just place with increasing offset
    if (!candidate) {
      const offset = positionedTiles.current.size * minTileDistance * 0.5;
      candidate = {
        x: parentCenterX + offset - tileWidth / 2,
        y: parentCenterY - tileHeight / 2,
        width: tileWidth,
        height: tileHeight,
        branchId,
        forced: true
      };
    }

    return candidate;
  }, [minTileDistance, enablePoissonDisc, enableBranchBoundaries, tilePositions]);

  /**
   * Register a tile in the positioning system
   */
  const registerTile = useCallback((tileId, rect, branchId = null) => {
    occupancyMap.current.registerTile(tileId, rect, branchId);
    positionedTiles.current.add(tileId);
    
    setTilePositions(prev => ({
      ...prev,
      [tileId]: { x: rect.x, y: rect.y, branchId }
    }));

    // Update branch boundary
    if (branchId && enableBranchBoundaries) {
      boundaryManager.current.updateBranchBoundary(branchId, occupancyMap.current);
    }
  }, [enableBranchBoundaries]);

  /**
   * Unregister a tile
   */
  const unregisterTile = useCallback((tileId) => {
    const tile = occupancyMap.current.tileRegistry.get(tileId);
    const branchId = tile?.branchId;
    
    occupancyMap.current.unregisterTile(tileId);
    positionedTiles.current.delete(tileId);
    physics.current.clearVelocity(tileId);

    setTilePositions(prev => {
      const next = { ...prev };
      delete next[tileId];
      return next;
    });

    // Update branch boundary after removal
    if (branchId && enableBranchBoundaries) {
      boundaryManager.current.updateBranchBoundary(branchId, occupancyMap.current);
    }
  }, [enableBranchBoundaries]);

  /**
   * Apply repulsion physics to resolve overlaps
   */
  const applyRepulsionForces = useCallback(() => {
    if (!enablePhysics) return;

    const newPositions = physics.current.applyForces(occupancyMap.current, 3);
    
    // Update occupancy map with new positions
    for (const [tileId, newPos] of newPositions) {
      occupancyMap.current.unregisterTile(tileId);
      occupancyMap.current.registerTile(tileId, newPos, newPos.branchId);
    }

    // Update React state
    setTilePositions(prev => {
      const next = { ...prev };
      for (const [tileId, pos] of newPositions) {
        next[tileId] = { x: pos.x, y: pos.y, branchId: pos.branchId };
      }
      return next;
    });
  }, [enablePhysics]);

  /**
   * Check if area is clear for spawning
   */
  const isAreaClear = useCallback((rect, excludeTileId = null) => {
    return occupancyMap.current.isAreaClear(rect, excludeTileId, minTileDistance * 0.3);
  }, [minTileDistance]);

  /**
   * Get all tiles near a point
   */
  const getNearbyTiles = useCallback((x, y, radius) => {
    return occupancyMap.current.getNearbyTiles(x, y, radius);
  }, []);

  /**
   * Clear all positioning data
   */
  const clearAll = useCallback(() => {
    occupancyMap.current.clear();
    boundaryManager.current.clear();
    physics.current.clearAll();
    positionedTiles.current.clear();
    setTilePositions({});
  }, []);

  // Run physics simulation on interval when enabled
  useEffect(() => {
    if (!enablePhysics) return;

    const interval = setInterval(() => {
      if (positionedTiles.current.size > 1) {
        applyRepulsionForces();
      }
    }, 50); // 20fps physics updates

    return () => clearInterval(interval);
  }, [enablePhysics, applyRepulsionForces]);

  return {
    tilePositions,
    calculateSpawnPosition,
    registerTile,
    unregisterTile,
    applyRepulsionForces,
    isAreaClear,
    getNearbyTiles,
    clearAll,
    getStats: () => ({
      totalTiles: positionedTiles.current.size,
      totalBranches: boundaryManager.current.branchBoxes.size
    })
  };
}

export default useTilePositioning;
