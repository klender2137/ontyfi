// cryptoUtils.js - Web Crypto API utilities for encrypting user data with wallet-derived key

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Derive encryption key from wallet signature
export async function deriveEncryptionKey(signature) {
  // Hash the signature to get a 256-bit key
  const signatureBytes = encoder.encode(signature);
  const hash = await crypto.subtle.digest('SHA-256', signatureBytes);
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// Encrypt data (expects string, returns base64 string)
export async function encryptData(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const dataBytes = encoder.encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBytes
  );
  // Combine IV and ciphertext, encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt data (expects base64 string, returns string)
export async function decryptData(key, encryptedData) {
  const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertext
  );
  return decoder.decode(decrypted);
}

// Minify JSON
export function minifyJSON(obj) {
  return JSON.stringify(obj);
}

// Parse JSON
export function parseJSON(str) {
  return JSON.parse(str);
}
