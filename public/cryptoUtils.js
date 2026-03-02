// cryptoUtils.js - Web Crypto API utilities for encryption
// Generates deterministic encryption keys from wallet signatures
// Provides AES-GCM encryption/decryption for user data

class CryptoUtils {
  constructor() {
    this.algorithm = { name: 'AES-GCM', length: 256 };
    this.hashAlgorithm = 'SHA-256';
  }

  // Generate a deterministic encryption key from a wallet signature
  async generateKeyFromSignature(signature, salt = 'crypto-explorer-salt') {
    try {
      // Convert signature to Uint8Array
      const signatureBytes = this.hexToBytes(signature.startsWith('0x') ? signature.slice(2) : signature);
      
      // Combine signature with salt
      const combined = new Uint8Array(signatureBytes.length + salt.length);
      combined.set(signatureBytes);
      combined.set(new TextEncoder().encode(salt), signatureBytes.length);
      
      // Hash the combined data
      const hash = await crypto.subtle.digest(this.hashAlgorithm, combined);
      
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
      console.error('Error generating key from signature:', error);
      throw error;
    }
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

  // Generate a signature for key derivation (one-time use)
  async generateSignatureMessage(address, timestamp = Date.now()) {
    return `CryptoExplorer authentication\nAddress: ${address}\nTimestamp: ${timestamp}`;
  }
}

// Export singleton instance
const cryptoUtils = new CryptoUtils();

if (typeof window !== 'undefined') {
  window.CryptoUtils = cryptoUtils;
}
