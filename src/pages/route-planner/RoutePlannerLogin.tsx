import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isSafeNextPath } from '@/lib/authNext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, LogIn, Loader2, Mail } from 'lucide-react';

/**
 * GasMask Route Planner — dedicated field login.
 * Reuses the existing GasMask auth backend (no second auth system).
 */
export default function RoutePlannerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, session, loading: authLoading } = useAuth();

  const stateReturnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const nextParam = new URLSearchParams(location.search).get('next');
  const requested = [stateReturnTo, nextParam].find(isSafeNextPath) ?? null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!authLoading && user && session) {
    return <Navigate to={requested ?? '/route-planner'} replace />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(requested ?? '/route-planner', { replace: true });
    } catch (err: any) {
      toast.error(err?.message?.includes('Invalid login') ? 'Invalid email or password' : (err?.message || 'Login failed'));
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
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success('Password reset email sent');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-x-hidden">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <MapPin className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-2xl">GasMask Route Planner</CardTitle>
          <CardDescription>Sign in to open your assigned route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && !forgotMode && handleLogin()}
            />
          </div>

          {!forgotMode && (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          )}

          {forgotMode ? (
            resetSent ? (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Check your email</p>
                <p className="text-xs text-muted-foreground mt-1">Reset link sent to {email}</p>
              </div>
            ) : (
              <Button className="w-full h-12" onClick={handleForgotPassword} disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</> : 'Send Reset Link'}
              </Button>
            )
          ) : (
            <Button className="w-full h-12 text-base" onClick={handleLogin} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</> : <><LogIn className="h-4 w-4 mr-2" />Sign In</>}
            </Button>
          )}

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => { setForgotMode(!forgotMode); setResetSent(false); }}
            >
              {forgotMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
