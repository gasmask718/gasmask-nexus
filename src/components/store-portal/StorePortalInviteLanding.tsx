import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import { readFunctionError } from '@/lib/storePortal';

interface Props {
  token: string;
  storeName: string | null;
  phoneLast4: string | null;
}

/** Store portal sign-in: a 6-digit code is texted to the number on the invite. No passwords. */
export default function StorePortalInviteLanding({ token, storeName, phoneLast4 }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true); setError(null);
    const { error } = await supabase.functions.invoke('store-portal-auth', { body: { action: 'send_code', token } });
    setBusy(false);
    if (error) return setError(await readFunctionError(error));
    setStep('code');
  }

  async function verify() {
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('store-portal-auth', {
        body: { action: 'verify_code', token, code },
      });
      if (error) throw new Error(await readFunctionError(error));
      const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
      if (otpErr) throw otpErr;
      const { data: red, error: redErr } = await supabase.functions.invoke('redeem-portal-invite', { body: { token } });
      if (redErr) throw new Error(await readFunctionError(redErr));
      if (red && red.success === false) throw new Error(red.error || 'Could not finish sign-in');
      navigate('/portal/mystore', { replace: true });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 shadow">
        <div className="space-y-1 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">GasMask Store Portal</h1>
          {storeName && <p className="text-muted-foreground">{storeName}</p>}
        </div>

        {step === 'start' ? (
          <>
            <p className="text-center text-sm text-muted-foreground">
              We'll text a 6-digit sign-in code to the phone ending in <strong>{phoneLast4 ?? '••••'}</strong>.
            </p>
            <Button className="h-14 w-full text-lg" onClick={sendCode} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageSquare className="mr-2 h-5 w-5" />}
              Text me a code
            </Button>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-muted-foreground">Enter the code we texted you.</p>
            <Input
              inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              className="h-14 text-center text-2xl tracking-[0.5em]"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <Button className="h-14 w-full text-lg" onClick={verify} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />} Sign in
            </Button>
            <Button variant="ghost" className="w-full" onClick={sendCode} disabled={busy}>Send a new code</Button>
          </>
        )}
        {error && <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          After signing in, add this page to your home screen to come back anytime.
        </p>
      </div>
    </div>
  );
}
