/**
 * Ambassador Portal entry point (/ambassador, /ambassador/portal).
 *
 * Entry context — NOT a role change — decides the destination:
 *   signed out -> /ambassador/login (which lands on the portal after auth)
 *   signed in  -> /ambassador/dashboard (field mode)
 *
 * A user who enters through the normal /auth login keeps their normal
 * role home. Nothing here grants privileges; the portal routes still run
 * through ProtectedRoute + RequireRole.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isSafeNextPath } from '@/lib/authNext';

const PORTAL_HOME = '/ambassador/dashboard';

export default function AmbassadorPortalEntry() {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Opening Ambassador Portal…</p>
        </div>
      </div>
    );
  }

  // Only same-origin relative paths are ever honored (no external redirects).
  const nextParam = new URLSearchParams(location.search).get('next');
  const target = isSafeNextPath(nextParam) ? nextParam : PORTAL_HOME;

  if (user && session) return <Navigate to={target} replace />;

  return <Navigate to="/ambassador/login" replace state={{ returnTo: target }} />;
}
