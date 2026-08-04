import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Crown } from 'lucide-react';

/**
 * RoleRouter — the PWA launch target (`start_url: /portal`).
 *
 * Resolves where the app should open for THIS user rather than dropping
 * everyone on a single hard-coded page:
 *   no session      → /auth (returns here after sign-in)
 *   session, no profile → /portal/onboarding
 *   session + role  → getRoleRedirectPath(role)
 */
export default function RoleRouter() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCurrentUserProfile();
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading');
  const [sessionChecked, setSessionChecked] = useState(false);

  // Signed-out launches (cold PWA open) must go to auth, not onboarding.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session) {
        navigate(`/auth?redirect=${encodeURIComponent('/portal')}`, { replace: true });
        return;
      }
      setSessionChecked(true);
    });
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (!sessionChecked || isLoading) return;

    // Error fetching profile
    if (error) {
      console.error('Profile fetch error:', error);
      setStatus('error');
      setTimeout(() => navigate('/portal/onboarding', { replace: true }), 1500);
      return;
    }

    // No profile exists, send to onboarding
    if (!data?.profile) {
      navigate('/portal/onboarding', { replace: true });
      return;
    }

    setStatus('redirecting');

    // Get redirect path based on primary role from centralized config
    const role = data.profile.primary_role as OSRole;
    const redirectPath = getRoleRedirectPath(role);

    console.log('🚀 RoleRouter: Redirecting', role, '→', redirectPath);
    navigate(redirectPath, { replace: true });
  }, [data, isLoading, error, navigate, sessionChecked]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="text-center space-y-6">
        {/* Animated Logo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="absolute -inset-2 rounded-3xl bg-primary/20 animate-pulse" />
        </div>

        {/* Status Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Dynasty OS</h2>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {status === 'loading' && 'Loading your profile...'}
              {status === 'redirecting' && 'Redirecting to your portal...'}
              {status === 'error' && 'Setting up your account...'}
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="w-48 mx-auto">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" 
                 style={{ width: status === 'redirecting' ? '80%' : '40%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
