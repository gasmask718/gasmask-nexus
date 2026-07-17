import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
      const nextParam = url.searchParams.get('next');
      const errorDesc =
        url.searchParams.get('error_description') ||
        url.searchParams.get('error');

      const safeNext =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/auth')
          ? nextParam
          : '/';

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
          navigate(safeNext, { replace: true });
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
            navigate(safeNext, { replace: true });
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
