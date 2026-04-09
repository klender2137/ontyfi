/**
 * GoogleDriveService - Client-side Google Drive API with OAuth
 * No backend required - uses Google API Client Library (GAPI)
 */

(function() {
  'use strict';

  class GoogleDriveService {
    constructor() {
      this.accessToken = null;
      this.tokenClient = null;
      this.isInitialized = false;
      this.initPromise = null;
      this.SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
    }

    /**
     * Initialize GAPI and OAuth2 client
     */
    async initialize() {
      if (this.isInitialized) return true;
      if (this.initPromise) return this.initPromise;

      this.initPromise = this._doInitialize();
      return this.initPromise;
    }

    async _doInitialize() {
      try {
        // Load GAPI script dynamically
        if (!window.gapi) {
          await this._loadScript('https://apis.google.com/js/api.js');
        }

        // Load Google Identity Services
        if (!window.google?.accounts?.oauth2) {
          await this._loadScript('https://accounts.google.com/gsi/client');
        }

        // Initialize GAPI client
        await new Promise((resolve, reject) => {
          window.gapi.load('client', { callback: resolve, onerror: reject });
        });

        // Initialize with API key (public, safe for client-side)
        // Note: In production, this should be restricted to your domain
        await window.gapi.client.init({
          apiKey: '', // API key is optional when using OAuth tokens
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });

        this.isInitialized = true;
        console.log('[GoogleDriveService] Initialized successfully');
        return true;

      } catch (error) {
        console.error('[GoogleDriveService] Initialization failed:', error);
        throw error;
      }
    }

    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    }

    /**
     * Request OAuth access token using Google Identity Services
     */
    async authenticate() {
      await this.initialize();

      return new Promise((resolve, reject) => {
        if (!this.tokenClient) {
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this._getClientId(),
            scope: this.SCOPES,
            callback: (tokenResponse) => {
              if (tokenResponse.error) {
                reject(new Error(tokenResponse.error));
              } else {
                this.accessToken = tokenResponse.access_token;
                resolve(this.accessToken);
              }
            },
          });
        }

        this.tokenClient.requestAccessToken();
      });
    }

    /**
     * Get OAuth Client ID from environment or config
     * In production, this should be configured via environment variables
     */
    _getClientId() {
      // Try to get from window config
      const clientId = window.GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        console.warn('[GoogleDriveService] No GOOGLE_CLIENT_ID configured');
      }
      return clientId;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
      return !!this.accessToken;
    }

    /**
     * GATEKEEPER: Fetch file with integrity validation
     * Validates Content-Type and buffer before returning
     */
    async fetchFileBinary(fileId, options = {}) {
      await this.initialize();

      if (!this.accessToken) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      const { onProgress = null, signal = null } = options;

      console.log(`[GoogleDriveService] Fetching file: ${fileId}`);

      // Use direct Drive API endpoint with OAuth token
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          signal,
        });

        // GATEKEEPER: Check Content-Type before processing
        const contentType = response.headers.get('Content-Type') || '';
        const contentLength = parseInt(response.headers.get('Content-Length') || '0');

        console.log(`[Gatekeeper] Content-Type: ${contentType}, Length: ${contentLength}`);

        // If we get HTML or JSON back, it's an ERROR, not a document
        if (contentType.includes('text/html')) {
          const errorText = await response.text();
          throw new Error(`Drive API Error (HTML): ${errorText.substring(0, 200)}`);
        }

        if (contentType.includes('application/json')) {
          const errorJson = await response.json();
          throw new Error(`Drive API Error (JSON): ${JSON.stringify(errorJson)}`);
        }

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        // Stream the response with progress tracking
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
              percent: Math.round((receivedLength / contentLength) * 100),
            });
          }
        }

        // Concatenate chunks into ArrayBuffer
        const arrayBuffer = this._concatChunks(chunks, receivedLength);

        // Validate buffer size
        if (arrayBuffer.byteLength < 100) {
          throw new Error(`File too small (${arrayBuffer.byteLength} bytes) - likely corrupted or empty`);
        }

        // Compute hash for integrity verification
        const hash = await this._computeHash(arrayBuffer);

        console.log(`[GoogleDriveService] Fetched ${receivedLength} bytes successfully`);

        return {
          data: arrayBuffer,
          hash,
          size: receivedLength,
          contentType,
          fileId,
        };

      } catch (error) {
        console.error('[GoogleDriveService] Fetch failed:', error);
        throw error;
      }
    }

    /**
     * Alternative: Use GAPI client for metadata (no CORS issues)
     */
    async getFileMetadata(fileId) {
      await this.initialize();

      try {
        const response = await window.gapi.client.drive.files.get({
          fileId: fileId,
          fields: 'id, name, mimeType, size, thumbnailLink, webViewLink',
        });

        return response.result;
      } catch (error) {
        console.error('[GoogleDriveService] Metadata fetch failed:', error);
        throw error;
      }
    }

    _concatChunks(chunks, totalLength) {
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result.buffer;
    }

    async _computeHash(arrayBuffer) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Sign out and revoke token
     */
    signOut() {
      if (this.accessToken && window.google?.accounts?.oauth2) {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {
          console.log('[GoogleDriveService] Token revoked');
        });
      }
      this.accessToken = null;
    }
  }

  // Create global instance
  window.GoogleDriveService = new GoogleDriveService();
})();
