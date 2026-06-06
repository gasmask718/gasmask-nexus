import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Store } from 'lucide-react';

/**
 * Store signup — tokenized binding flow:
 * link comes from gasmask-order-receipt SMS (?token=...). We validate, create
 * the auth user, then mark the token used (store_signup_tokens.used_by).
 */
export default function StoreSignupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<{ id: string; name: string | null; phone: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from('store_signup_tokens' as any)
        .select('store_id, store_name, phone, expires_at, used_at')
        .eq('token', token)
        .maybeSingle();
      const row = data as any;
      if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
        setStore(null);
      } else {
        setStore({ id: row.store_id, name: row.store_name, phone: row.phone });
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!store || !email || !password) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/owner`,
          data: { linked_store_id: store.id, source: 'order_receipt_signup' },
        },
      });
      if (error) throw error;
      await supabase.from('store_signup_tokens' as any)
        .update({ used_at: new Date().toISOString(), used_by: data.user?.id ?? null })
        .eq('token', token);
      toast.success('Account created — check your email to verify');
      setTimeout(() => navigate('/owner'), 1500);
    } catch (e: any) {
      toast.error(e.message ?? 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  if (!token || !store) {
    return (
      <div className="container max-w-md mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <p className="font-semibold">This signup link is invalid or expired.</p>
            <p className="text-sm text-muted-foreground">
              Contact your delivery rep for a new link, or sign in if you already have an account.
            </p>
            <Button variant="outline" onClick={() => navigate('/auth')}>Go to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Create account for {store.name ?? 'your store'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We've pre-linked this account to your store record so all your past orders and receipts show up immediately.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy || !email || !password} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account & open portal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
