import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type LookupState =
  | { status: 'loading' }
  | { status: 'invalid'; error: string }
  | { status: 'ok'; email: string; role: string; company: { name: string; brand_color: string | null } };

export default function VAAcceptInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState<LookupState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('accept-va-invite', {
        body: { token, action: 'lookup' },
      });
      if (cancelled) return;
      if (error || (data as any)?.error) {
        setLookup({ status: 'invalid', error: (data as any)?.error ?? error?.message ?? 'Invalid invite' });
      } else {
        setLookup({ status: 'ok', ...(data as any) });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    if (lookup.status !== 'ok') return;
    setSubmitting(true);
    try {
      // 1. Sign in or sign up
      const { data: existing } = await supabase.auth.signInWithPassword({
        email: lookup.email, password,
      });
      if (!existing.session) {
        const { data: signed, error: signErr } = await supabase.auth.signUp({
          email: lookup.email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (signErr) throw signErr;
        if (!signed.session) {
          // Email confirmation required — try sign-in immediately
          const { error: siErr } = await supabase.auth.signInWithPassword({
            email: lookup.email, password,
          });
          if (siErr) throw new Error('Account created — please check your email to confirm, then return to this link.');
        }
      }

      // 2. Bind membership
      const { data, error } = await supabase.functions.invoke('accept-va-invite', {
        body: { token, action: 'accept' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`Welcome to ${(data as any).company?.name ?? 'your team'}!`);
      navigate('/va/dashboard');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">VA Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lookup.status === 'loading' && (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" /></div>
          )}
          {lookup.status === 'invalid' && (
            <div className="text-center py-8 space-y-2">
              <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
              <p className="text-red-300">{lookup.error}</p>
            </div>
          )}
          {lookup.status === 'ok' && (
            <>
              <div className="rounded-lg p-4 border" style={{
                borderColor: (lookup.company.brand_color ?? '#06b6d4') + '55',
                background: (lookup.company.brand_color ?? '#06b6d4') + '11',
              }}>
                <p className="text-sm text-slate-300">You've been invited to join</p>
                <p className="text-xl font-bold" style={{ color: lookup.company.brand_color ?? '#06b6d4' }}>
                  {lookup.company.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">as {lookup.role} · {lookup.email}</p>
              </div>

              <div>
                <Label className="text-slate-300">Full name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Password (min 8 chars)</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <Button onClick={accept} disabled={submitting || password.length < 8}
                className="w-full bg-cyan-600 hover:bg-cyan-700">
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting up…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-2" /> Accept invite</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
