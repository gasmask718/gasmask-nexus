import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';
import { Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function InviteLanding() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { canInstall, triggerInstall } = usePwaInstall();
  const [status, setStatus] = useState<'checking' | 'needs_login' | 'redeeming' | 'success' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [assignedRole, setAssignedRole] = useState<string | null>(null);

  // No auto-trigger — let PwaInstallBanner handle it on click

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setStatus('needs_login');
      return;
    }

    if (!token || token.length < 32) {
      setStatus('error');
      setError('Invalid invite link');
      return;
    }

    redeemInvite();
  }, [user, authLoading, token]);

  const redeemInvite = async () => {
    if (!token || !user) return;
    setStatus('redeeming');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('redeem-portal-invite', {
        body: { token },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to redeem invite');
      }

      if (data?.success) {
        setAssignedRole(data.role);
        setStatus('success');
        toast.success(`Welcome! You've been assigned the ${data.role} role.`);

        setTimeout(() => {
          const path = getRoleRedirectPath(data.role as OSRole);
          navigate(path, { replace: true });
        }, 2000);
      } else {
        setStatus('error');
        setError(data?.error || 'Invite redemption failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleLogin = () => {
    if (token) {
      sessionStorage.setItem('pending_invite_token', token);
    }
    navigate('/auth', { state: { returnTo: `/portal/invite/${token}` } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-6 max-w-sm w-full">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground">GasMask Ops Invite</h1>

        {status === 'checking' && (
          <div className="space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Verifying invite...</p>
          </div>
        )}

        {status === 'needs_login' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to accept this invite.
            </p>
            <Button onClick={handleLogin} className="w-full">
              Sign In to Continue
            </Button>
          </div>
        )}

        {status === 'redeeming' && (
          <div className="space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Activating your access...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm text-foreground font-medium">
              Access granted as <span className="capitalize">{assignedRole}</span>!
            </p>
            <p className="text-xs text-muted-foreground">Redirecting to your portal...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <div className="space-y-2">
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Go Home
              </Button>
              <p className="text-xs text-muted-foreground">
                Contact your administrator if this issue persists.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
