import { useAuth } from '../contexts/AuthContext';

export function useWeb3Auth() {
  const { isAuthenticated, user, isGuest } = useAuth();
  return { isAuthenticated, user, isGuest };
}
