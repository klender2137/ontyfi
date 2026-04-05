import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROLES_DIR = path.join(__dirname, '../data/roles');

// Cache for admin list to avoid reading file on every request
let adminCache = null;
let adminCacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Parse role file content (format: username / email)
 * Returns array of { username, email } objects
 */
function parseRoleFile(content) {
  if (!content) return [];
  
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')) // Skip empty lines and comments
    .map(line => {
      // Parse "username / email" format
      const parts = line.split('/').map(p => p.trim());
      if (parts.length >= 2) {
        return {
          username: parts[0],
          email: parts[1]
        };
      }
      // Fallback: if no / separator, treat whole line as username
      return { username: line, email: null };
    })
    .filter(entry => entry.username);
}

/**
 * Load and parse admins file
 */
function loadAdmins() {
  const now = Date.now();
  
  // Return cached if valid
  if (adminCache && (now - adminCacheTimestamp) < CACHE_TTL) {
    return adminCache;
  }
  
  try {
    const adminsPath = path.join(ROLES_DIR, 'admins');
    if (!fs.existsSync(adminsPath)) {
      console.warn('[RoleService] Admins file not found');
      return [];
    }
    
    const content = fs.readFileSync(adminsPath, 'utf8');
    adminCache = parseRoleFile(content);
    adminCacheTimestamp = now;
    
    console.log(`[RoleService] Loaded ${adminCache.length} admins`);
    return adminCache;
  } catch (error) {
    console.error('[RoleService] Error loading admins:', error);
    return [];
  }
}

/**
 * Check if a user is an admin
 * @param {string} username - The username to check
 * @param {string} email - Optional email to check
 * @returns {boolean}
 */
export function isAdmin(username, email = null) {
  if (!username) return false;
  
  const admins = loadAdmins();
  const normalizedUsername = username.toLowerCase().trim();
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  
  return admins.some(admin => {
    const adminUsername = admin.username.toLowerCase();
    if (adminUsername === normalizedUsername) return true;
    
    // Also check email if provided
    if (normalizedEmail && admin.email) {
      return admin.email.toLowerCase() === normalizedEmail;
    }
    
    return false;
  });
}

/**
 * Get list of all admin usernames (for debugging/internal use)
 * Does not expose emails
 */
export function getAdminUsernames() {
  const admins = loadAdmins();
  return admins.map(a => a.username);
}

/**
 * Clear admin cache (useful for hot-reload scenarios)
 */
export function clearAdminCache() {
  adminCache = null;
  adminCacheTimestamp = 0;
}

export default {
  isAdmin,
  getAdminUsernames,
  clearAdminCache
};
