import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMarkManualSignIn } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Headset, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VAAuthPage() {
  const navigate = useNavigate();
  const markManualSignIn = useMarkManualSignIn();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });

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
        navigate('/va/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // Create profile with VA role
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: form.fullName,
            role: 'va',
          } as any);
        }

        toast.success('Account created! Please check your email to verify, then sign in.');
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
          <p className="text-sm text-slate-400">Brandaro Virtual Assistant Login</p>
        </CardHeader>
        <CardContent>
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
                className="bg-slate-800 border-slate-700 text-white"
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
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
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
