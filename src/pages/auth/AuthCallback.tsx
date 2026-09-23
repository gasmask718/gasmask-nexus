import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';
import { consumePendingNext, isSafeNextPath } from '@/lib/authNext';
import { isAmbassadorHost, AMBASSADOR_PORTAL_ENTRY } from '@/lib/portalHost';

/**
 * An ambassador who confirms their email must return to their invite link —
 * never to the generic GasMask sign-in page. The email link already carries
 * `next`; this is the fallback when a provider strips the query string.
 */
function pendingAmbassadorInvitePath(): string | null {
  try {
    const token = localStorage.getItem('gasmask_pending_ambassador_invite');
    return token ? `/invite/ambassador/${token}` : null;
  } catch {
    return null;
  }
}

async function resolveRoleDestination(fallback: string): Promise<string> {
  // The hostname that initiated the login decides the interface — an
  // owner/admin confirming through the ambassador subdomain stays in the
  // Ambassador Portal. No role is read or changed here.
  if (isAmbassadorHost()) return AMBASSADOR_PORTAL_ENTRY;
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
      const rawHash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(rawHash);
      // OAuth providers drop the original query string — fall back to the
      // destination parked before the round-trip (e.g. /portal/wholesaler).
      const nextParam =
        url.searchParams.get('next') ?? consumePendingNext() ?? pendingAmbassadorInvitePath();

      // Errors arrive in the query string (PKCE) OR the hash (implicit/verify).
      const errorCode =
        url.searchParams.get('error_code') || hashParams.get('error_code') || '';
      const errorDesc =
        url.searchParams.get('error_description') ||
        url.searchParams.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        '';

      const safeNext = isSafeNextPath(nextParam) ? nextParam : '/';

      const bounceFail = (reason: string) => {
        // Keep the intended destination (e.g. the ambassador invite) so signing
        // in from the bounce page lands where the email link was headed.
        const keepNext = isSafeNextPath(nextParam)
          ? `&next=${encodeURIComponent(nextParam as string)}`
          : '';
        navigate(`/auth?verify=failed&reason=${encodeURIComponent(reason)}${keepNext}`, {
          replace: true,
        });
      };

      const goOn = async () => {
        const dest = nextParam ? safeNext : await resolveRoleDestination(safeNext);
        navigate(dest, { replace: true });
      };

      /**
       * Session storage hydrates asynchronously — a single immediate read can
       * miss an existing session and wrongly report a verification failure.
       */
      const hasSession = async (): Promise<boolean> => {
        for (let i = 0; i < 6; i++) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) return true;
          await new Promise((r) => setTimeout(r, 250));
        }
        return false;
      };

      const isUsedOrExpired =
        /expired|invalid|not_found|access_denied/i.test(errorCode) ||
        /expired|already|invalid|not found/i.test(errorDesc);

      if (errorDesc || errorCode) {
        // The link may have been consumed by an email scanner AFTER it already
        // confirmed the account — if a real session exists, just continue.
        if (await hasSession()) {
          await goOn();
          return;
        }
        bounceFail(
          isUsedOrExpired
            ? 'This confirmation link was already used or expired. Try signing in, or resend the confirmation email.'
            : errorDesc || errorCode,
        );
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (await hasSession()) {
              await goOn();
              return;
            }
            bounceFail(error.message);
            return;
          }
          toast.success('Email verified');
          await goOn();
          return;
        }

        // Implicit / recovery flow — tokens in the URL hash.
        if (rawHash) {
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              bounceFail(error.message);
              return;
            }
            toast.success('Email verified');
            await goOn();
            return;
          }
        }

        // Compatibility fallback: ?token_hash=&type= style links.
        const tokenHash = url.searchParams.get('token_hash') || hashParams.get('token_hash');
        const otpType = (url.searchParams.get('type') || hashParams.get('type') || 'email') as any;
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
          if (error) {
            if (await hasSession()) {
              await goOn();
              return;
            }
            bounceFail(
              /expired|invalid|not found/i.test(error.message)
                ? 'This confirmation link was already used or expired. Try signing in, or resend the confirmation email.'
                : error.message,
            );
            return;
          }
          toast.success('Email verified');
          await goOn();
          return;
        }

        // No verification payload at all — an existing session still counts.
        if (await hasSession()) {
          await goOn();
          return;
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
