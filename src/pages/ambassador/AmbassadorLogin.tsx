import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogIn, Loader2, Mail } from 'lucide-react';

export default function AmbassadorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // SOURCE OF TRUTH: user_roles. An ambassador row is nice-to-have but
      // not required — admins assigning the role via the User Mgmt UI write
      // to user_roles only.
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id);

      const userRoles: string[] = (roleRows ?? []).map((r: any) => r.role);
      const elevatedRoles = ['owner', 'admin', 'ceo', 'employee'];
      const hasAmbassadorRole = userRoles.includes('ambassador');
      const isElevated = userRoles.some((r) => elevatedRoles.includes(r));

      if (!hasAmbassadorRole && !isElevated) {
        // Legacy fallback: check ambassador table by auth id / email
        const { data: amb } = await supabase
          .from('unforgettable_ambassadors' as any)
          .select('id')
          .or(`auth_user_id.eq.${data.user.id},email.eq.${email}`)
          .maybeSingle();

        if (!amb) {
          await supabase.auth.signOut();
          toast.error('No ambassador access on this account. Contact admin.');
          return;
        }
      }

      toast.success('Welcome back!');
      // Nexus ambassadors (user_roles) land on the real ambassador portal;
      // legacy UT-only accounts (unforgettable_ambassadors match) keep the UT dashboard.
      navigate(hasAmbassadorRole || isElevated ? '/ambassador/dashboard' : '/ut/ambassador/dashboard');
    } catch (err: any) {
      if (err.message?.includes('Invalid login')) {
        toast.error('Invalid email or password');
      } else {
        toast.error(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/ambassador/set-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <LogIn className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle>Ambassador Login</CardTitle>
          <CardDescription>
            Sign in to your Unforgettable Times ambassador dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && !forgotMode && handleLogin()}
            />
          </div>

          {!forgotMode && (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          )}

          {forgotMode ? (
            resetSent ? (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Check your email</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We sent a password reset link to {email}
                </p>
              </div>
            ) : (
              <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            )
          ) : (
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
              ) : (
                <><LogIn className="h-4 w-4 mr-2" />Sign In</>
              )}
            </Button>
          )}

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => { setForgotMode(!forgotMode); setResetSent(false); }}
            >
              {forgotMode ? 'Back to login' : 'Forgot password?'}
            </button>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            Don't have an account?{' '}
            <Link to="/apply/ambassador" className="text-primary hover:underline">
              Apply to become an ambassador
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
