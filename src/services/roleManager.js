// Role definitions and management system for CryptoExplorer0.5
// This handles user role assignments and permissions

export const ROLES = {
  USER: 'user',
  MEMBER: 'member', 
  ADMIN: 'admin'
};

export const ROLE_LEVELS = {
  [ROLES.USER]: 0,
  [ROLES.MEMBER]: 1,
  [ROLES.ADMIN]: 2
};

export const PERMISSIONS = {
  // Basic permissions (all users)
  VIEW_TREE: 'view_phi_tree',
  CREATE_BOOKMARKS: 'create_bookmarks',
  
  // Member permissions
  ACCESS_PREMIUM_CONTENT: 'access_premium_content',
  EXPORT_DATA: 'export_data',
  ADVANCED_FILTERING: 'advanced_filtering',
  
  // Admin permissions
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  SYSTEM_CONFIG: 'system_config',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_CONTENT: 'manage_content'
};

export const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.VIEW_TREE,
    PERMISSIONS.VIEW_HUSTLES,
    PERMISSIONS.CREATE_BOOKMARKS
  ],
  
  [ROLES.MEMBER]: [
    ...ROLE_PERMISSIONS[ROLES.USER],
    PERMISSIONS.ACCESS_PREMIUM_CONTENT,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ADVANCED_FILTERING
  ],
  
  [ROLES.ADMIN]: [
    ...ROLE_PERMISSIONS[ROLES.MEMBER],
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_CONTENT
  ]
};

// Role management utilities
export class RoleManager {
  constructor(firestore) {
    this.firestore = firestore;
    this.rolesCollection = this.firestore.collection('user_roles');
  }

  // Get user role from Firebase
  async getUserRole(userId) {
    try {
      const doc = await this.rolesCollection.doc(userId).get();
      if (doc.exists) {
        return doc.data().role || ROLES.USER;
      }
      return ROLES.USER; // Default role
    } catch (error) {
      console.error('Error getting user role:', error);
      return ROLES.USER;
    }
  }

  // Set user role in Firebase
  async setUserRole(userId, role, assignedBy = null) {
    try {
      if (!Object.values(ROLES).includes(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      const roleData = {
        role,
        assignedAt: new Date(),
        assignedBy: assignedBy || 'system'
      };

      await this.rolesCollection.doc(userId).set(roleData, { merge: true });
      console.log(`User ${userId} role set to ${role}`);
      return true;
    } catch (error) {
      console.error('Error setting user role:', error);
      throw error;
    }
  }

  // Check if user has specific permission
  async hasPermission(userId, permission) {
    const role = await this.getUserRole(userId);
    return ROLE_PERMISSIONS[role]?.includes(permission) || false;
  }

  // Check if user has at least the specified role level
  async hasRoleLevel(userId, minimumRole) {
    const userRole = await this.getUserRole(userId);
    return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minimumRole];
  }

  // Get all users with a specific role
  async getUsersByRole(role) {
    try {
      const snapshot = await this.rolesCollection.where('role', '==', role).get();
      return snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting users by role:', error);
      return [];
    }
  }

  // Initialize role for new user based on predefined lists
  async initializeUserRole(userId, email, username) {
    try {
      // Check if user is in admin list
      const admins = await this.loadRoleList('admins');
      if (this.isInRoleList(admins, username, email)) {
        await this.setUserRole(userId, ROLES.ADMIN, 'system');
        return ROLES.ADMIN;
      }

      // Check if user is in member list
      const members = await this.loadRoleList('members');
      if (this.isInRoleList(members, username, email)) {
        await this.setUserRole(userId, ROLES.MEMBER, 'system');
        return ROLES.MEMBER;
      }

      // Default to user role
      await this.setUserRole(userId, ROLES.USER, 'system');
      return ROLES.USER;
    } catch (error) {
      console.error('Error initializing user role:', error);
      return ROLES.USER;
    }
  }

  // Load role list from file (for initial setup)
  async loadRoleList(roleName) {
    try {
      // In a real implementation, this would load from the roles files
      // For now, we'll use hardcoded values from the files we created
      if (roleName === 'admins') {
        return ['fokenstart / calliduschalk@gmail.com'];
      } else if (roleName === 'members') {
        return []; // Empty for now
      }
      return [];
    } catch (error) {
      console.error(`Error loading ${roleName} list:`, error);
      return [];
    }
  }

  // Check if user is in role list
  isInRoleList(roleList, username, email) {
    return roleList.some(entry => {
      const [listUsername, listEmail] = entry.split(' / ').map(s => s.trim());
      return (listUsername && listUsername === username) || 
             (listEmail && listEmail === email);
    });
  }

  // Get role statistics
  async getRoleStats() {
    try {
      const stats = {
        [ROLES.USER]: 0,
        [ROLES.MEMBER]: 0,
        [ROLES.ADMIN]: 0,
        total: 0
      };

      const snapshot = await this.rolesCollection.get();
      snapshot.docs.forEach(doc => {
        const role = doc.data().role || ROLES.USER;
        stats[role]++;
        stats.total++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting role stats:', error);
      return { [ROLES.USER]: 0, [ROLES.MEMBER]: 0, [ROLES.ADMIN]: 0, total: 0 };
    }
  }
}

// React hook for role management
export const useRoleManager = (firestore) => {
  const roleManager = new RoleManager(firestore);
  
  return {
    getUserRole: (userId) => roleManager.getUserRole(userId),
    setUserRole: (userId, role, assignedBy) => roleManager.setUserRole(userId, role, assignedBy),
    hasPermission: (userId, permission) => roleManager.hasPermission(userId, permission),
    hasRoleLevel: (userId, minimumRole) => roleManager.hasRoleLevel(userId, minimumRole),
    getUsersByRole: (role) => roleManager.getUsersByRole(role),
    initializeUserRole: (userId, email, username) => roleManager.initializeUserRole(userId, email, username),
    getRoleStats: () => roleManager.getRoleStats()
  };
};

export default RoleManager;
