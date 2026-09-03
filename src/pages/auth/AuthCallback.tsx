import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';
import { consumePendingNext, isSafeNextPath } from '@/lib/authNext';

async function resolveRoleDestination(fallback: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallback;
    const { data: rows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const roles = (rows ?? []).map((r: any) => String(r.role).toLowerCase());
    // Priority: admin/owner/ceo > va > any assigned > fallback
    if (roles.some((r) => ['admin', 'owner', 'ceo'].includes(r))) return '/';
    if (roles.includes('va')) return getRoleRedirectPath('va' as OSRole);
    if (roles[0]) return getRoleRedirectPath(roles[0] as OSRole);
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Handles Supabase auth email redirects (PKCE ?code=... or implicit
 * #access_token=...). Exchanges the code for a session, then redirects
 * to `next` (validated same-origin relative path) or `/`.
 *
 * On failure, bounces to /auth?verify=failed&reason=... so the sign-in
 * page can surface an inline "Resend verification email" button.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      // OAuth providers drop the original query string — fall back to the
      // destination parked before the round-trip (e.g. /portal/wholesaler).
      const nextParam = url.searchParams.get('next') ?? consumePendingNext();
      const errorDesc =
        url.searchParams.get('error_description') ||
        url.searchParams.get('error');

      const safeNext = isSafeNextPath(nextParam) ? nextParam : '/';

      const bounceFail = (reason: string) => {
        navigate(`/auth?verify=failed&reason=${encodeURIComponent(reason)}`, { replace: true });
      };

      if (errorDesc) {
        bounceFail(errorDesc);
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            bounceFail(error.message);
            return;
          }
          toast.success('Email verified');
          const dest = nextParam ? safeNext : await resolveRoleDestination(safeNext);
          navigate(dest, { replace: true });
          return;
        }

        // Implicit / recovery flow — tokens in the URL hash.
        const hash = window.location.hash?.startsWith('#')
          ? window.location.hash.slice(1)
          : '';
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              bounceFail(error.message);
              return;
            }
            toast.success('Email verified');
            const dest = nextParam ? safeNext : await resolveRoleDestination(safeNext);
            navigate(dest, { replace: true });
            return;
          }
        }

        bounceFail('Missing verification code');
      } catch (e: any) {
        bounceFail(e?.message ?? 'Verification failed');
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    </div>
  );
}
