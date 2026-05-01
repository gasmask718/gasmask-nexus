import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * VAAcceptInvitePage — bounces straight to /va/auth with the invite token preserved.
 * The VA auth page handles signup/login + invite acceptance.
 */
export default function VAAcceptInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Persist invite token so VAAuthPage can complete acceptance after signup/login
    if (token) {
      try { sessionStorage.setItem('va_invite_token', token); } catch {}
    }
    navigate(`/va/auth?invite=${encodeURIComponent(token)}`, { replace: true });
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" />
        <p className="text-slate-300 text-sm">Redirecting to VA sign up…</p>
      </div>
    </div>
  );
}
