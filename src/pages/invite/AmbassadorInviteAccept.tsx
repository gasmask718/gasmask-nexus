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

type InviteState = 'validating' | 'valid' | 'invalid' | 'signup' | 'accepting' | 'done';

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
      setState('valid');
    })();
  }, [token]);

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
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create account');

      // 2. Accept invite (creates ambassador record + role)
      const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_ambassador_invite', {
        p_token: token!,
        p_user_id: authData.user.id,
      });

      if (acceptError) throw acceptError;
      if (!(acceptResult as any)?.success) throw new Error((acceptResult as any)?.error || 'Failed to accept invite');

      setState('done');
      toast.success('Welcome! Your ambassador account is ready.');
    } catch (err: any) {
      setState('valid');
      toast.error(err.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
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

        {(state === 'valid' || state === 'accepting') && (
          <>
            <CardHeader className="text-center">
              <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
              <CardTitle>Join as Ambassador</CardTitle>
              <CardDescription>
                You've been invited to join the ambassador program. Create your account below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Shield className="h-3 w-3 shrink-0" />
                  Your role will be set to <strong>Ambassador</strong>. This cannot be changed during signup.
                </p>
              </div>

              <Button className="w-full" onClick={handleSignup} disabled={isSubmitting}>
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
              <Button onClick={() => navigate('/ambassador/dashboard')}>
                Go to Dashboard
              </Button>
            </CardContent>

          </>
        )}
      </Card>
    </div>
  );
}
