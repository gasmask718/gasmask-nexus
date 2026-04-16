import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * DevOnlyGuard — Restricts certain accounts (e.g. dev@gmail.com) to /developer only.
 * Any attempt to navigate elsewhere is redirected back to /developer.
 */
const DEV_ONLY_EMAILS = ['dev@gmail.com'];
const ALLOWED_PREFIXES = ['/developer', '/auth'];

export function DevOnlyGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || !user?.email) return <>{children}</>;
  if (!DEV_ONLY_EMAILS.includes(user.email)) return <>{children}</>;

  const path = location.pathname;
  const allowed = ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
  if (allowed) return <>{children}</>;

  return <Navigate to="/developer" replace />;
}

export default DevOnlyGuard;
