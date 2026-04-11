// cryptoUtils.js - Web Crypto API utilities for encrypting user data with OIDC session-derived key

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Derive encryption key from OIDC session token (Firebase ID token)
// Replaces wallet signature-based key derivation for OIDC-only auth
export async function deriveEncryptionKey(sessionToken) {
  if (!sessionToken) {
    throw new Error('Session token required for key derivation');
  }
  // Hash the session token to get a 256-bit key
  const tokenBytes = encoder.encode(sessionToken);
  const hash = await crypto.subtle.digest('SHA-256', tokenBytes);
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// Legacy alias for backwards compatibility
export async function deriveKeyFromSignature(signature) {
  console.warn('[cryptoUtils] deriveKeyFromSignature is deprecated. Use deriveEncryptionKey with session token.');
  return deriveEncryptionKey(signature);
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
