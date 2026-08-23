import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMarkManualSignIn } from '@/contexts/AuthContext';
import { getVACompanyConfig } from '@/config/vaCompanies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Headset, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VAAuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const markManualSignIn = useMarkManualSignIn();

  // Optional hub scoping: /va/auth/:businessSlug or /va/auth?business=slug
  const hubSlug = (params.businessSlug || searchParams.get('business') || '').trim().toLowerCase();

  // Pull invite token from query string or sessionStorage (set by VAAcceptInvitePage)
  const inviteToken =
    searchParams.get('invite') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('va_invite_token') : '') ||
    '';
  const hasInvite = !!inviteToken;

  type Mode = 'login' | 'signup' | 'forgot';
  const [mode, setMode] = useState<Mode>(hasInvite ? 'signup' : 'login');
  const isLogin = mode === 'login';
  const setIsLogin = (v: boolean) => setMode(v ? 'login' : 'signup');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(hasInvite);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/va/reset-password`,
      });
      if (error) throw error;
      toast.success('If an account exists, a reset link has been sent.');
      setMode('login');
    } catch (err: any) {
      // Don't leak existence — generic success message
      toast.success('If an account exists, a reset link has been sent.');
    } finally {
      setLoading(false);
    }
  };

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

  // Single source of truth: va_company_memberships. Elevated app roles and
  // invite-holders also pass so owners/admins and fresh invitees aren't locked
  // out (invite acceptance provisions the membership server-side).
  const verifyVAAccessOrSignOut = async (userId: string): Promise<boolean> => {
    const [{ data: memberships }, { data: userRoles }] = await Promise.all([
      supabase
        .from('va_company_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ]);

    const elevatedRoles = ['owner', 'admin', 'ceo', 'super_admin', 'dynasty_owner'];
    const roles = (userRoles || []).map((r: any) => (r.role as string)?.trim().toLowerCase());
    const hasVAAccess =
      (memberships && memberships.length > 0) ||
      roles.some((r) => elevatedRoles.includes(r));

    if (!hasVAAccess && !hasInvite) {
      await supabase.auth.signOut();
      toast.error(
        'Access denied. You have no VA company membership — ask an admin for an invite.',
      );
      return false;
    }
    return true;
  };

  // Hub-scoped login: /va/auth/:businessSlug requires an active membership in
  // the VA company that calls for that business (matched via VA_COMPANY_CONFIG).
  const selectHubBusinessOrSignOut = async (userId: string): Promise<boolean> => {
    if (!hubSlug) return true;

    const { data } = await supabase
      .from('va_company_memberships')
      .select('company_id, va_companies:company_id ( slug, name )')
      .eq('user_id', userId)
      .eq('is_active', true);

    const memberships = (data || []) as any[];
    const match = memberships.find((m) => {
      const slug = (m.va_companies?.slug as string)?.trim().toLowerCase();
      if (!slug) return false;
      if (slug === hubSlug) return true;
      return getVACompanyConfig(slug).businessSlugs.includes(hubSlug);
    });

    if (!match) {
      await supabase.auth.signOut();
      toast.error(`You are not a member of the ${hubSlug} calling company.`);
      return false;
    }
    // Pre-select that company so the portal lands scoped to the hub.
    try { localStorage.setItem('va_active_company_id', match.company_id); } catch {}
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        markManualSignIn();
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        if (authData.user && !(await verifyVAAccessOrSignOut(authData.user.id))) {
          return;
        }
        await acceptInviteIfNeeded();
        if (authData.user && !(await selectHubBusinessOrSignOut(authData.user.id))) {
          return;
        }
        navigate('/va/dashboard');

      } else {
        if (hasInvite) {
          const { data, error } = await supabase.functions.invoke('accept-va-invite', {
            body: {
              token: inviteToken,
              action: 'complete_signup',
              password: form.password,
              fullName: form.fullName,
            },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);

          markManualSignIn();
          const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          });
          if (signInError) throw signInError;
          if (authData.user && !(await verifyVAAccessOrSignOut(authData.user.id))) {
            return;
          }
          if (authData.user && !(await selectHubBusinessOrSignOut(authData.user.id))) {
            return;
          }

          try { sessionStorage.removeItem('va_invite_token'); } catch {}
          toast.success(`Welcome${companyName ? ` to ${companyName}` : ''}!`);
          navigate('/va/dashboard');
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        toast.success(
          'Account created! Check your email to verify, then click the invite link from your admin to join a company.',
        );
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
          <p className="text-sm text-slate-400">
            {hubSlug ? `${hubSlug} hub — Virtual Assistant Portal` : 'Virtual Assistant Portal'}
          </p>
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
          ) : mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-slate-300">
                Enter your account email and we'll send you a password reset link.
              </p>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="va@brandaro.com"
                  required
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-sm text-cyan-400 hover:text-cyan-300"
              >
                Back to sign in
              </button>
            </form>
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
            {isLogin && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="block ml-auto text-xs text-cyan-400 hover:text-cyan-300"
              >
                Forgot password?
              </button>
            )}
            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isLogin ? 'Sign In' : hasInvite ? 'Create Account & Join' : 'Create Account'}
            </Button>
          </form>
          )}
          {mode !== 'forgot' && (
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm text-cyan-400 hover:text-cyan-300 mt-4"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
