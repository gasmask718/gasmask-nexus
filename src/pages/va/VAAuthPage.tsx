import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMarkManualSignIn } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Headset, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VAAuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const markManualSignIn = useMarkManualSignIn();

  // Pull invite token from query string or sessionStorage (set by VAAcceptInvitePage)
  const inviteToken =
    searchParams.get('invite') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('va_invite_token') : '') ||
    '';
  const hasInvite = !!inviteToken;

  const [isLogin, setIsLogin] = useState(!hasInvite); // invited users default to signup
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(hasInvite);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });

  // If we have an invite token, look up the email/company so the form is pre-filled
  useEffect(() => {
    if (!hasInvite) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('accept-va-invite', {
          body: { token: inviteToken, action: 'lookup' },
        });
        if (cancelled) return;
        if (error || (data as any)?.error) {
          toast.error((data as any)?.error ?? error?.message ?? 'Invalid invite');
        } else {
          setForm(f => ({ ...f, email: (data as any).email ?? '' }));
          setCompanyName((data as any).company?.name ?? null);
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hasInvite, inviteToken]);

  const acceptInviteIfNeeded = async () => {
    if (!hasInvite) return;
    const { data, error } = await supabase.functions.invoke('accept-va-invite', {
      body: { token: inviteToken, action: 'accept' },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    try { sessionStorage.removeItem('va_invite_token'); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        markManualSignIn();
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        await acceptInviteIfNeeded();
        navigate('/va/dashboard');
      } else {
        const { data: signed, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // If we have a session immediately, accept the invite & route to dashboard
        if (signed.session && hasInvite) {
          await acceptInviteIfNeeded();
          toast.success(`Welcome${companyName ? ` to ${companyName}` : ''}!`);
          navigate('/va/dashboard');
          return;
        }

        if (hasInvite) {
          // Try immediate sign-in (if email confirmation isn't required)
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (!siErr) {
            await acceptInviteIfNeeded();
            toast.success(`Welcome${companyName ? ` to ${companyName}` : ''}!`);
            navigate('/va/dashboard');
            return;
          }
          toast.success('Account created! Verify your email, then return to the invite link.');
        } else {
          toast.success(
            'Account created! Check your email to verify, then click the invite link from your admin to join a company.',
          );
        }
        setIsLogin(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(217 33% 17%) 50%, hsl(222 47% 11%) 100%)' }}>
      <Card className="w-full max-w-md border-cyan-500/20 bg-slate-900/90 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <Headset className="h-8 w-8 text-cyan-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">VA Portal</CardTitle>
          <p className="text-sm text-slate-400">Virtual Assistant Portal</p>
          {hasInvite && companyName && (
            <div className="mx-auto rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
              You've been invited to join <strong>{companyName}</strong>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {lookupLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Full Name</label>
                <Input
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Your full name"
                  required={!isLogin}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="va@brandaro.com"
                required
                disabled={hasInvite}
                className="bg-slate-800 border-slate-700 text-white disabled:opacity-70"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isLogin ? 'Sign In' : hasInvite ? 'Create Account & Join' : 'Create Account'}
            </Button>
          </form>
          )}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-center text-sm text-cyan-400 hover:text-cyan-300 mt-4"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
