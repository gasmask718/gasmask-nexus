import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

// Claim flow: the partner arrives via Supabase magic link with an active session.
// They set THEIR OWN password — we never set it. Then we link tt_partners.user_id
// via the tt_claim_partner RPC and route them to their portal.
export default function PartnerClaim() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const partnerId = search.get('partner_id');

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        toast.error('Invite link expired or invalid. Please ask admin to resend.');
        return;
      }
      setReady(true);
    });
  }, []);

  const onSubmit = async () => {
    if (!partnerId) return toast.error('Missing partner_id in invite link.');
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (password !== confirm) return toast.error('Passwords do not match.');

    setSaving(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      const { error: claimErr } = await supabase.rpc('tt_claim_partner', {
        _partner_id: partnerId,
      });
      if (claimErr) throw claimErr;

      toast.success('Portal activated — welcome!');
      navigate('/partner/portal');
    } catch (e: any) {
      toast.error(e.message ?? 'Claim failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Claim your TopTier Partner Portal</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Set your password to activate your partner account. Your existing jobs are already waiting inside.
          </p>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Verifying invite link…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={onSubmit} disabled={saving}>
              {saving ? 'Activating…' : 'Activate portal'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
