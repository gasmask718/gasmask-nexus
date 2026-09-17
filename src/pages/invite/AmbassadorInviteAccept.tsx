/**
 * AmbassadorInviteAccept — Public page for invite token validation + signup
 * Role is locked to ambassador. No open registration.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, AlertTriangle, Check, UserPlus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import InstallAppPrompt from '@/components/pwa/InstallAppPrompt';

type InviteState =
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'signup'
  | 'accepting'
  | 'awaiting_confirm'
  | 'done';

export default function AmbassadorInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<InviteState>('validating');
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setState('invalid');
      setError('No invite token provided');
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc('validate_ambassador_invite', { p_token: token });
      if (error || !(data as any)?.valid) {
        setState('invalid');
        setError((data as any)?.error || error?.message || 'Invalid invite');
        return;
      }
      setInviteData(data);
      if ((data as any)?.email) setEmail((data as any).email);

      // Returning from the email-confirmation link: a session now exists, so
      // finish the acceptance automatically instead of asking for a password.
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.user) {
        setState('accepting');
        const ok = await finishAccept(sess.session.user.id);
        if (ok) return;
      }
      setState('valid');
    })();
  }, [token]);

  // Applies the invite: role, profile and ambassador record all come from the
  // trusted invite record — the user is never asked to pick a role.
  const finishAccept = async (userId: string): Promise<boolean> => {
    const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_ambassador_invite', {
      p_token: token!,
      p_user_id: userId,
    });
    if (acceptError) {
      toast.error(acceptError.message || 'Could not activate your account');
      return false;
    }
    if (!(acceptResult as any)?.success) {
      toast.error((acceptResult as any)?.error || 'Could not activate your account');
      return false;
    }
    try { localStorage.removeItem('gasmask_pending_ambassador_invite'); } catch { /* noop */ }
    setState('done');
    toast.success('Welcome! Your ambassador account is ready.');
    return true;
  };

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    setState('accepting');

    try {
      let userId: string | null = null;

      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session?.user) {
        userId = sess.session.user.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            // Come back to this same invite link after confirming, so setup
            // completes automatically.
            // Confirmation goes through the auth callback (it exchanges the
            // code for a session) and is then handed straight back to THIS
            // invite link, so ambassador setup finishes automatically instead
            // of dropping the user on the generic GasMask sign-in page.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              `/invite/ambassador/${token}`,
            )}`,
          },
        });

        if (authError) {
          // Account already exists — sign in and link that login instead of
          // creating a second account.
          const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
          if (siErr || !si?.session) throw authError;
          userId = si.session.user.id;
        } else if (authData.session?.user) {
          userId = authData.session.user.id;
        } else {
          // Email confirmation required — no session yet.
          const { data: si } = await supabase.auth.signInWithPassword({ email, password });
          if (si?.session?.user) {
            userId = si.session.user.id;
          } else {
            // Safe, non-sensitive breadcrumb (token only) so the confirmation
            // round-trip can always find its way back to this invite.
            try {
              localStorage.setItem('gasmask_pending_ambassador_invite', token!);
            } catch { /* storage unavailable — email link still carries `next` */ }
            setState('awaiting_confirm');
            setIsSubmitting(false);
            return;
          }
        }
      }

      if (!userId) throw new Error('Failed to create account');
      const ok = await finishAccept(userId);
      if (!ok) setState('valid');
    } catch (err: any) {
      setState('valid');
      toast.error(err.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 w-full overflow-x-hidden">
      <Card className="w-full max-w-md mx-auto">
        {state === 'validating' && (
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validating invite...</p>
          </CardContent>
        )}

        {state === 'invalid' && (
          <>
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle>Invalid Invite</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" onClick={() => navigate('/')}>
                Go Home
              </Button>
            </CardContent>
          </>
        )}

        {state === 'awaiting_confirm' && (
          <>
            <CardHeader className="text-center">
              <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
              <CardTitle>Confirm your email</CardTitle>
              <CardDescription>
                We sent a confirmation link to <strong>{email}</strong>. Open it on this device and
                you'll come straight back here — your ambassador access is set up automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-xs text-muted-foreground">
              Your invite link stays valid until you confirm.
            </CardContent>
          </>
        )}

        {(state === 'valid' || state === 'accepting') && (
          <>
            <CardHeader className="text-center">
              <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
              <CardTitle>Join as Ambassador</CardTitle>
              <CardDescription>
                You've been invited to join the ambassador program. Create your account below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Your full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isSubmitting || !!inviteData?.email}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/50 p-4 flex items-start gap-3">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug">Ambassador</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Your role is already set from this invite.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    It cannot be changed during signup.
                  </p>
                </div>
              </div>

              <Button className="w-full h-12 text-base" onClick={handleSignup} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account & Join
                  </>
                )}
              </Button>
            </CardContent>
          </>
        )}

        {state === 'done' && (
          <>
            <CardHeader className="text-center">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <CardTitle>Welcome Aboard!</CardTitle>
              <CardDescription>
                Your ambassador account has been created successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <InstallAppPrompt compact />
              <Button onClick={() => navigate('/ambassador', { replace: true })}>
                Go to Dashboard
              </Button>
            </CardContent>

          </>
        )}
      </Card>
    </div>
  );
}
