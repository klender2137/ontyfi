import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from '../services/roleManager'

// React hook for managing user roles and permissions
export const useUserRole = () => {
  const [userRole, setUserRole] = useState(ROLES.USER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const auth = getAuth()
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setLoading(true)
        try {
          // Listen to user document for role changes
          const userDocRef = doc(db, 'users', user.uid)
          const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
            if (doc.exists) {
              const userData = doc.data()
              setUserRole(userData.role || ROLES.USER)
              setError(null)
            } else {
              setUserRole(ROLES.USER)
              setError('User document not found')
            }
            setLoading(false)
          }, (err) => {
            console.error('Error listening to user role:', err)
            setError(err.message)
            setUserRole(ROLES.USER)
            setLoading(false)
          })

          return unsubscribeUser
        } catch (err) {
          console.error('Error setting up role listener:', err)
          setError(err.message)
          setUserRole(ROLES.USER)
          setLoading(false)
        }
      } else {
        setUserRole(ROLES.USER)
        setLoading(false)
        setError(null)
      }
    })

    return unsubscribe
  }, [])

  return { userRole, loading, error }
}

// React hook for checking permissions
export const usePermissions = () => {
  const { userRole, loading, error } = useUserRole()

  const hasPermission = (permission) => {
    if (loading || error) return false
    return ROLE_PERMISSIONS[userRole]?.includes(permission) || false
  }

  const hasRoleLevel = (minimumRole) => {
    if (loading || error) return false
    const roleLevels = {
      [ROLES.USER]: 0,
      [ROLES.MEMBER]: 1,
      [ROLES.ADMIN]: 2
    }
    return roleLevels[userRole] >= roleLevels[minimumRole]
  }

  const isAdmin = () => userRole === ROLES.ADMIN
  const isMember = () => userRole === ROLES.MEMBER || userRole === ROLES.ADMIN
  const isUser = () => true // All authenticated users are at least users

  return {
    hasPermission,
    hasRoleLevel,
    isAdmin,
    isMember,
    isUser,
    userRole,
    loading,
    error
  }
}

// Higher-order component for role-based route protection
export const withRoleProtection = (WrappedComponent, requiredRole = ROLES.USER) => {
  return (props) => {
    const { hasRoleLevel, loading, userRole } = usePermissions()

    if (loading) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: '#0f172a', 
          color: '#f7f9ff', 
          minHeight: '100vh' 
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚡</div>
          <h2>Checking permissions...</h2>
          <p style={{ color: '#94a3b8' }}>Verifying your access level</p>
        </div>
      )
    }

    if (!hasRoleLevel(requiredRole)) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: '#0f172a', 
          color: '#f7f9ff', 
          minHeight: '100vh' 
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Access Denied</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
            You need {requiredRole} level access to view this page.
            Your current role: {userRole}
          </p>
          <button 
            onClick={() => window.history.back()}
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            Go Back
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ 
              padding: '0.75rem 1.5rem', 
              background: '#374151', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer'
            }}
          >
            Home
          </button>
        </div>
      )
    }

    return <WrappedComponent {...props} />
  }
}

// Permission-based component renderer
export const PermissionGuard = ({ 
  permission, 
  role, 
  fallback = null, 
  children 
}) => {
  const { hasPermission, hasRoleLevel, loading } = usePermissions()

  if (loading) {
    return fallback || <div>Loading permissions...</div>
  }

  const hasAccess = permission 
    ? hasPermission(permission)
    : role 
    ? hasRoleLevel(role)
    : true

  return hasAccess ? children : (fallback || null)
}

// Role display component
export const RoleBadge = ({ role, size = 'small' }) => {
  const roleStyles = {
    [ROLES.USER]: { background: '#6b7280', label: 'User' },
    [ROLES.MEMBER]: { background: '#3b82f6', label: 'Member' },
    [ROLES.ADMIN]: { background: '#ef4444', label: 'Admin' }
  }

  const style = roleStyles[role] || roleStyles[ROLES.USER]
  const sizeStyles = {
    small: { padding: '0.25rem 0.5rem', fontSize: '0.7rem' },
    medium: { padding: '0.5rem 1rem', fontSize: '0.8rem' },
    large: { padding: '0.75rem 1.5rem', fontSize: '1rem' }
  }

  return (
    <span style={{
      background: style.background,
      color: 'white',
      padding: sizeStyles[size].padding,
      borderRadius: '6px',
      fontSize: sizeStyles[size].fontSize,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {style.label}
    </span>
  )
}

export default useUserRole
