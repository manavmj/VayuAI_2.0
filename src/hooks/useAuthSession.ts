import { useCallback, useEffect, useState } from 'react';
import type { AuthUser, UserRole } from '../types/vayu.ts';
import {
  apiFetch,
  fetchCurrentSessionUser,
  scrubLegacyInsecureStorage,
  setSessionToken,
} from '../utils/authClient.ts';

export function useAuthSession(onRoleSync?: (role: UserRole) => void) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    scrubLegacyInsecureStorage();
    void fetchCurrentSessionUser().then((verifiedUser) => {
      if (verifiedUser) {
        setCurrentUser(verifiedUser);
        onRoleSync?.(verifiedUser.role);
      }
    });
  }, [onRoleSync]);

  const handleAuthenticated = useCallback(
    (user: AuthUser) => {
      setSessionNotice(null);
      setCurrentUser(user);
      onRoleSync?.(user.role);
    },
    [onRoleSync]
  );

  const handleLogout = useCallback(() => {
    setSessionToken(null);
    setCurrentUser(null);
    void apiFetch('/api/auth/logout', { method: 'POST' });
  }, []);

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  return {
    currentUser,
    sessionNotice,
    setSessionNotice,
    clearSessionNotice,
    handleAuthenticated,
    handleLogout,
  };
}
