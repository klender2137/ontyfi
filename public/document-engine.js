/**
 * DocumentEngine - High-Performance Multi-Format Document Engine (HAR-Optimized)
 * 
 * Features:
 * - Binary streaming with IndexedDB cache
 * - WebWorker-based rendering for non-blocking UI
 * - Viewport-only lazy rendering
 * - Layout pre-calculation with Pretext
 */

(function() {
  'use strict';

  const DB_NAME = 'DocumentEngineCache';
  const DB_VERSION = 1;
  const STORE_NAME = 'fileBinaries';
  const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  class DocumentEngine {
    constructor() {
      this.db = null;
      this.workers = new Map();
      this.renderCache = new Map();
      this.initPromise = this.initIndexedDB();
    }

    async initIndexedDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('hash', 'hash', { unique: false });
          }
        };
      });
    }

    async fetchFileBinary(fileId, options = {}) {
      await this.initPromise;
      
      const { skipCache = false, onProgress = null } = options;
      
      // Check IndexedDB cache first
      if (!skipCache) {
        const cached = await this.getCachedBinary(fileId);
        if (cached) {
          console.log(`[DocumentEngine] Cache hit for ${fileId}`);
          return cached;
        }
      }
      
      // Fetch from server API
      console.log(`[DocumentEngine] Fetching binary for ${fileId}`);
      const startTime = performance.now();
      
      const response = await fetch(`/api/insights/file-content?id=${encodeURIComponent(fileId)}`, {
        headers: {
          'Accept': '*/*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (onProgress && contentLength) {
          onProgress({
            loaded: receivedLength,
            total: contentLength,
            percent: Math.round((receivedLength / contentLength) * 100)
          });
        }
      }
      
      // Concatenate chunks into ArrayBuffer
      const arrayBuffer = this.concatChunks(chunks, receivedLength);
      const fetchTime = performance.now() - startTime;
      
      console.log(`[DocumentEngine] Fetched ${receivedLength} bytes in ${fetchTime.toFixed(0)}ms`);
      
      // Compute hash for cache validation
      const hash = await this.computeHash(arrayBuffer);
      
      // Store in IndexedDB
      await this.cacheBinary(fileId, arrayBuffer, hash);
      
      return { data: arrayBuffer, hash, size: receivedLength };
    }

    concatChunks(chunks, totalLength) {
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result.buffer;
    }

    async computeHash(arrayBuffer) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async getCachedBinary(fileId) {
      if (!this.db) return null;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(fileId);
        
        request.onsuccess = () => {
          const result = request.result;
          if (!result) return resolve(null);
          
          // Check cache age
          const age = Date.now() - result.timestamp;
          if (age > CACHE_MAX_AGE) {
            console.log(`[DocumentEngine] Cache expired for ${fileId}`);
            this.deleteCachedBinary(fileId);
            return resolve(null);
          }
          
          resolve({
            data: result.data,
            hash: result.hash,
            size: result.size,
            cached: true
          });
        };
        
        request.onerror = () => reject(request.error);
      });
    }

    async cacheBinary(fileId, data, hash) {
      if (!this.db) return;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const entry = {
          fileId,
          data,
          hash,
          size: data.byteLength,
          timestamp: Date.now()
        };
        
        const request = store.put(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    async deleteCachedBinary(fileId) {
      if (!this.db) return;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    async clearCache() {
      if (!this.db) return;
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Get or create WebWorker for document processing
    getWorker(type) {
      if (this.workers.has(type)) {
        return this.workers.get(type);
      }
      
      const workerUrl = this.createWorkerBlob(type);
      const worker = new Worker(workerUrl, { type: 'module' });
      this.workers.set(type, worker);
      
      return worker;
    }

    createWorkerBlob(type) {
      const workerScripts = {
        pdf: this.getPDFWorkerScript(),
        excel: this.getExcelWorkerScript(),
        docx: this.getDocxWorkerScript(),
        image: this.getImageWorkerScript()
      };
      
      const blob = new Blob([workerScripts[type] || workerScripts.pdf], { type: 'application/javascript' });
      return URL.createObjectURL(blob);
    }

    getPDFWorkerScript() {
      return `
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        self.onmessage = async function(e) {
          const { arrayBuffer, fileId, pageNum = 1, scale = 1.5 } = e.data;
          
          try {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(pageNum);
            
            const viewport = page.getViewport({ scale });
            const canvas = new OffscreenCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');
            
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            const bitmap = canvas.transferToImageBitmap();
            
            self.postMessage({
              type: 'pageRendered',
              pageNum,
              totalPages: pdf.numPages,
              bitmap,
              viewport: {
                width: viewport.width,
                height: viewport.height
              }
            }, [bitmap]);
            
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        };
      `;
    }

    getExcelWorkerScript() {
      return `
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        
        self.onmessage = async function(e) {
          const { arrayBuffer, fileId, sheetIndex = 0, rowStart = 0, rowCount = 50 } = e.data;
          
          try {
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellStyles: true });
            
            const sheetName = workbook.SheetNames[sheetIndex];
            const worksheet = workbook.Sheets[sheetName];
            
            // Get sheet range
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
            const totalRows = range.e.r - range.s.r + 1;
            const totalCols = range.e.c - range.s.c + 1;
            
            // Convert only visible rows to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              range: rowStart,
              limit: rowCount
            });
            
            self.postMessage({
              type: 'sheetData',
              sheetName,
              sheetNames: workbook.SheetNames,
              data: jsonData,
              totalRows,
              totalCols,
              rowStart,
              rowCount
            });
            
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        };
      `;
    }

    getDocxWorkerScript() {
      return `
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        
        self.onmessage = async function(e) {
          const { arrayBuffer, fileId } = e.data;
          
          try {
            const result = await mammoth.convertToHtml({ arrayBuffer }, {
              styleMap: [
                "p[style-name='Heading 1'] => h1",
                "p[style-name='Heading 2'] => h2",
                "p[style-name='Heading 3'] => h3"
              ]
            });
            
            self.postMessage({
              type: 'docxRendered',
              html: result.value,
              messages: result.messages
            });
            
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        };
      `;
    }

    getImageWorkerScript() {
      return `
        self.onmessage = async function(e) {
          const { arrayBuffer, fileId, mimeType } = e.data;
          
          try {
            const blob = new Blob([arrayBuffer], { type: mimeType || 'image/png' });
            const bitmap = await createImageBitmap(blob);
            
            self.postMessage({
              type: 'imageDecoded',
              bitmap,
              width: bitmap.width,
              height: bitmap.height
            }, [bitmap]);
            
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        };
      `;
    }

    // Render document using appropriate worker
    async renderDocument(fileId, arrayBuffer, fileType, options = {}) {
      const worker = this.getWorker(fileType);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Document rendering timeout'));
        }, 30000);
        
        const handler = (e) => {
          const { type, error, ...data } = e.data;
          
          if (type === 'error') {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
            reject(new Error(error));
          } else if (type === 'pageRendered' || type === 'sheetData' || type === 'docxRendered' || type === 'imageDecoded') {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
            resolve(data);
          }
        };
        
        worker.addEventListener('message', handler);
        worker.postMessage({
          arrayBuffer,
          fileId,
          ...options
        }, [arrayBuffer]);
      });
    }

    // Pre-calculate layout dimensions using Pretext approach
    measureTextDimensions(text, font = '14px system-ui') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = font;
      
      const lines = text.split('\\n');
      let maxWidth = 0;
      let totalHeight = 0;
      const lineHeight = 20;
      
      for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width);
        totalHeight += lineHeight;
      }
      
      return { width: maxWidth, height: totalHeight, lineHeight };
    }

    // Request idle callback wrapper with fallback
    requestIdle(callback, timeout = 2000) {
      if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, { timeout });
      }
      return setTimeout(callback, 1);
    }

    cancelIdle(id) {
      if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    }
  }

  // Create global instance
  window.DocumentEngine = new DocumentEngine();
})();
