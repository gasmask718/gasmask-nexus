import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
    const isAmbassadorSurface =
      location.pathname === '/ambassador' || location.pathname.startsWith('/ambassador/');

    return (
      <Navigate
        to={isAmbassadorSurface ? '/ambassador/login' : '/auth'}
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
