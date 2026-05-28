import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Loader2, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function VAResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a number';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success('Password updated');
      await supabase.auth.signOut();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const wrap = (body: JSX.Element) => (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(217 33% 17%) 50%, hsl(222 47% 11%) 100%)' }}>
      <Card className="w-full max-w-md border-cyan-500/20 bg-slate-900/90 backdrop-blur">
        {body}
      </Card>
    </div>
  );

  if (checking) return wrap(
    <CardContent className="py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-400" />
      <p className="text-sm text-slate-400 mt-3">Verifying reset link…</p>
    </CardContent>
  );

  if (!sessionReady) return wrap(
    <>
      <CardHeader className="text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
        <CardTitle className="text-white">Invalid or Expired Link</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-3">
        <p className="text-sm text-slate-400">Request a new password reset email from the VA portal.</p>
        <Button variant="outline" onClick={() => navigate('/va/auth')}>Back to Login</Button>
      </CardContent>
    </>
  );

  if (done) return wrap(
    <>
      <CardHeader className="text-center">
        <Check className="h-12 w-12 text-cyan-400 mx-auto mb-2" />
        <CardTitle className="text-white">Password Updated</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => navigate('/va/auth')}>
          Sign In
        </Button>
      </CardContent>
    </>
  );

  return wrap(
    <>
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
          <KeyRound className="h-7 w-7 text-cyan-400" />
        </div>
        <CardTitle className="text-white">Set New Password</CardTitle>
        <p className="text-xs text-slate-400">Min 8 chars, upper + lower + number</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">New Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={8} className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Confirm Password</label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required minLength={8} className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Update Password
          </Button>
        </form>
      </CardContent>
    </>
  );
}
