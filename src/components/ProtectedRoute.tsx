import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAmbassadorHost } from '@/lib/portalHost';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    // Ambassadors stay inside the dedicated Ambassador Portal experience
    // instead of being dropped into the full GasMask OS sign-in page.
    // Entry context: the ambassador subdomain keeps EVERY route inside the
    // ambassador sign-in, including the site root.
    const isAmbassadorSurface =
      isAmbassadorHost() ||
      location.pathname === '/ambassador' || location.pathname.startsWith('/ambassador/');
    // Route-planner users stay inside the dedicated Route Planner experience.
    const isRoutePlannerSurface =
      location.pathname === '/route-planner' || location.pathname.startsWith('/route-planner/');

    const loginPath = isAmbassadorSurface
      ? '/ambassador/login'
      : isRoutePlannerSurface
        ? '/route-planner/login'
        : '/auth';

    return (
      <Navigate
        to={loginPath}
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }


  return <>{children}</>;
};

export default ProtectedRoute;
