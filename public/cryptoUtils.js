// cryptoUtils.js - Web Crypto API utilities for encryption
// Generates deterministic encryption keys from OIDC session tokens
// Provides AES-GCM encryption/decryption for user data

class CryptoUtils {
  constructor() {
    this.algorithm = { name: 'AES-GCM', length: 256 };
    this.hashAlgorithm = 'SHA-256';
  }

  async generateKeyFromString(secret, salt = 'crypto-explorer-salt') {
    try {
      const input = `${String(secret || '')}:${String(salt || '')}`;
      const bytes = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest(this.hashAlgorithm, bytes);
      const key = await crypto.subtle.importKey(
        'raw',
        hash,
        this.algorithm,
        false,
        ['encrypt', 'decrypt']
      );
      return key;
    } catch (error) {
      console.error('Error generating key from string:', error);
      throw error;
    }
  }

  async compressString(str) {
    const s = String(str ?? '');
    if (typeof CompressionStream === 'undefined') return { alg: 'none', data: s };
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      await writer.write(new TextEncoder().encode(s));
      await writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();
      return { alg: 'gzip', data: this.bytesToBase64(new Uint8Array(compressed)) };
    } catch {
      return { alg: 'none', data: s };
    }
  }

  async decompressString(payload) {
    const p = payload || {};
    if (p.alg !== 'gzip') return String(p.data ?? '');
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not available in this browser');
    }
    const bytes = this.base64ToBytes(String(p.data || ''));
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const decompressed = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(decompressed);
  }

  // Generate a deterministic encryption key from OIDC session token
  // Replaces wallet signature-based key generation for OIDC-only auth
  async generateKeyFromSession(sessionToken, salt = 'crypto-explorer-salt') {
    try {
      // Use session token (Firebase ID token or similar) to derive key
      const tokenString = String(sessionToken || '');
      if (!tokenString) {
        throw new Error('Session token required for key generation');
      }

      // Combine token with salt using HKDF-like approach
      const tokenBytes = new TextEncoder().encode(tokenString);
      const saltBytes = new TextEncoder().encode(salt);

      // Use PBKDF2-like iteration for key derivation
      let combined = new Uint8Array(tokenBytes.length + saltBytes.length);
      combined.set(tokenBytes);
      combined.set(saltBytes, tokenBytes.length);

      // Multiple rounds of hashing for key stretching
      let hash = await crypto.subtle.digest(this.hashAlgorithm, combined);
      for (let i = 0; i < 1000; i++) {
        hash = await crypto.subtle.digest(this.hashAlgorithm, hash);
      }

      // Import as AES key
      const key = await crypto.subtle.importKey(
        'raw',
        hash,
        this.algorithm,
        false,
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      console.error('Error generating key from session:', error);
      throw error;
    }
  }

  // Legacy alias for backwards compatibility (deprecated)
  async generateKeyFromSignature(signature, salt = 'crypto-explorer-salt') {
    console.warn('[cryptoUtils] generateKeyFromSignature is deprecated. Use generateKeyFromSession.');
    return this.generateKeyFromSession(signature, salt);
  }

  // Encrypt data using AES-GCM
  async encryptData(key, data) {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm.name, iv },
        key,
        encodedData
      );
      
      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);
      
      // Return as base64 string
      return this.bytesToBase64(result);
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  // Decrypt data using AES-GCM
  async decryptData(key, encryptedData) {
    try {
      const encryptedBytes = this.base64ToBytes(encryptedData);
      
      const iv = encryptedBytes.slice(0, 12);
      const data = encryptedBytes.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm.name, iv },
        key,
        data
      );
      
      const decoded = new TextDecoder().decode(decrypted);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw error;
    }
  }

  // Utility: Convert hex string to Uint8Array
  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Utility: Convert Uint8Array to base64
  bytesToBase64(bytes) {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }

  // Utility: Convert base64 to Uint8Array
  base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Generate a session key derivation message for OIDC authentication
  // Replaces wallet signature messages for OIDC-only flow
  async generateSessionKeyMessage(userId, timestamp = Date.now()) {
    return `OntyFi OIDC Session\nUser: ${userId}\nTimestamp: ${timestamp}`;
  }

  // Legacy alias for backwards compatibility (deprecated)
  async generateSignatureMessage(address, timestamp = Date.now()) {
    console.warn('[cryptoUtils] generateSignatureMessage is deprecated. Use generateSessionKeyMessage.');
    return this.generateSessionKeyMessage(address, timestamp);
  }
}

// Export singleton instance
const cryptoUtils = new CryptoUtils();

if (typeof window !== 'undefined') {
  window.CryptoUtils = cryptoUtils;
}
