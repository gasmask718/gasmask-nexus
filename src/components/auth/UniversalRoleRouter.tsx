import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';
import { Loader2 } from 'lucide-react';

/**
 * UniversalRoleRouter - Fortune 500 grade role-based routing
 * 
 * Routes users to their appropriate portal/dashboard based on primary_role:
 * - ceo / admin → Command Penthouse or Main Dashboard
 * - va → VA Portal or Main Dashboard
 * - driver → Driver Portal
 * - biker → Biker Portal
 * - store → Store Portal
 * - wholesaler → Wholesaler Portal
 * - ambassador → Ambassador Portal
 * - production → Production Portal
 * - customer → Customer Portal
 * - no profile → Onboarding
 */
export default function UniversalRoleRouter() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCurrentUserProfile();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // If there's an error fetching profile, send to onboarding
    if (error) {
      console.log('Profile error, redirecting to onboarding');
      navigate('/portal/onboarding', { replace: true });
      return;
    }

    // No profile exists → send to onboarding
    if (!data?.profile) {
      console.log('No profile found, redirecting to onboarding');
      navigate('/portal/onboarding', { replace: true });
      return;
    }

    setRedirecting(true);

    // Get the primary role
    const role = data.profile.primary_role as OSRole;
    console.log('User role detected:', role);

    // Get redirect path based on role
    const redirectPath = getRoleRedirectPath(role);
    console.log('Redirecting to:', redirectPath);

    // Navigate to the appropriate portal
    navigate(redirectPath, { replace: true });
  }, [data, isLoading, error, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="absolute inset-0 animate-ping">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {redirecting ? 'Redirecting to your portal...' : 'Loading your profile...'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {redirecting 
              ? 'Taking you to your personalized dashboard' 
              : 'Authenticating and loading your Dynasty OS profile'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to get current user's role-based redirect path
 */
export function useRoleRedirect() {
  const { data, isLoading } = useCurrentUserProfile();
  
  const getRedirectPath = (): string => {
    if (!data?.profile) return '/portal/onboarding';
    const role = data.profile.primary_role as OSRole;
    return getRoleRedirectPath(role);
  };

  return {
    getRedirectPath,
    isLoading,
    role: data?.profile?.primary_role as OSRole | undefined,
  };
}
