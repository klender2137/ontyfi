import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for debouncing a value
 * @param {any} value - The value to debounce
 * @param {number} delay - The debounce delay in milliseconds
 * @returns {any} The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

/**
 * Custom hook for debouncing a callback function
 * @param {Function} callback - The function to debounce
 * @param {number} delay - The debounce delay in milliseconds
 * @returns {Function} The debounced function
 */
export function useDebouncedCallback(callback, delay = 300) {
  const timeoutRef = useRef(null)
  
  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return debouncedCallback
}

/**
 * Web Worker for heavy treemap geometry calculations
 * This offloads the D3/treemap layout logic from the main thread
 */
export class TreemapGeometryWorker {
  constructor() {
    this.worker = null
    this.pendingRequests = new Map()
    this.requestId = 0
    this.initWorker()
  }
  
  initWorker() {
    // Create worker inline to avoid separate file issues
    const workerScript = `
      self.onmessage = function(e) {
        const { requestId, nodes, width, height } = e.data;
        
        // Perform heavy geometry calculations
        const calculatedTiles = nodes.map((node, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const tileWidth = width / 3 - 20;
          const tileHeight = 200;
          
          return {
            id: node.id,
            x: col * (tileWidth + 20) + 10,
            y: row * (tileHeight + 20) + 10,
            width: tileWidth,
            height: tileHeight
          };
        });
        
        self.postMessage({
          requestId,
          tiles: calculatedTiles
        });
      };
    `;
    
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    
    this.worker.onmessage = (e) => {
      const { requestId, tiles } = e.data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(tiles);
        this.pendingRequests.delete(requestId);
      }
    };
  }
  
  calculateGeometry(nodes, width, height) {
    return new Promise((resolve) => {
      this.requestId++;
      this.pendingRequests.set(this.requestId, resolve);
      
      this.worker.postMessage({
        requestId: this.requestId,
        nodes,
        width,
        height
      });
    });
  }
  
  terminate() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}

// Singleton instance
let geometryWorkerInstance = null;

export function getGeometryWorker() {
  if (!geometryWorkerInstance) {
    geometryWorkerInstance = new TreemapGeometryWorker();
  }
  return geometryWorkerInstance;
}

/**
 * Data validator to filter out Firebase heartbeat/noise responses
 * Ignores responses smaller than 100 bytes (like Status 9 signals)
 */
export function validateNetworkResponse(response) {
  // If response is a string and too small, it's likely noise
  if (typeof response === 'string' && response.length < 100) {
    // Check for Status 9 pattern: "9\n[1,114,7]"
    if (response.match(/^\d+\n\[.*\]$/)) {
      console.log('[DataValidator] Ignoring Firebase heartbeat signal:', response);
      return null;
    }
    return null;
  }
  
  // If response is an object, check for valid data structure
  if (typeof response === 'object' && response !== null) {
    // Check for empty objects that might be noise
    if (Object.keys(response).length === 0) {
      console.log('[DataValidator] Ignoring empty object response');
      return null;
    }
    return response;
  }
  
  return response;
}
