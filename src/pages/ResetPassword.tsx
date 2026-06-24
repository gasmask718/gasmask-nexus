import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Loader2, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
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
    if (password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    toast.success('Password updated');
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card border-border/50">
        {checking ? (
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground mt-3">Verifying reset link…</p>
          </CardContent>
        ) : !sessionReady ? (
          <>
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle>Invalid or expired link</CardTitle>
              <CardDescription>Request a new password reset email.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" onClick={() => navigate('/forgot-password')}>
                Request new link
              </Button>
            </CardContent>
          </>
        ) : done ? (
          <>
            <CardHeader className="text-center">
              <Check className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Password updated</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate('/auth')}>Sign in</Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <KeyRound className="h-7 w-7 text-primary" />
              </div>
              <CardTitle>Set a new password</CardTitle>
              <CardDescription>At least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="bg-secondary/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input id="confirm-password" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                    className="bg-secondary/50 border-border/50" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update password
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
