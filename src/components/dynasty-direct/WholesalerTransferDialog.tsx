/**
 * Wholesaler account handover.
 *
 * The owner loads a catalogue under a caretaker login, then hands the whole
 * account to the real supplier. This dialog calls transfer_wholesaler_account(),
 * which flags the profile as caretaker-held, issues a wholesaler invite bound to
 * that exact profile id, and logs the handover. On acceptance the invite moves
 * user_id, rewrites company/contact/email, and CLEARS Stripe Connect so the real
 * supplier connects their own bank.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowRightLeft, Copy } from 'lucide-react';

interface Props {
  profileId: string;
  companyName: string | null;
  onDone?: () => void;
}

export function WholesalerTransferDialog({ profileId, companyName, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function start() {
    if (!email.trim()) return toast.error('New owner email required');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('transfer_wholesaler_account' as any, {
        p_profile_id: profileId,
        p_new_email: email.trim(),
        p_company_name: company.trim() || null,
        p_contact_name: contact.trim() || null,
        p_phone: phone.trim() || null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || 'Transfer could not be started');
      setLink(`${window.location.origin}${r.accept_url}`);
      toast.success('Handover started — account locked to caretaker until accepted');
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLink(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
          Transfer account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hand over — {companyName || 'supplier account'}</DialogTitle>
        </DialogHeader>

        {!link ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Products, drafts, orders, payouts and history stay on this account. The new owner
              sets their own login. Stripe Connect is cleared on acceptance — they must connect
              their own bank before any money moves.
            </p>
            <div>
              <Label>New owner email *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@theircompany.com" />
            </div>
            <div>
              <Label>Real company name</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Their Real Company LLC" />
            </div>
            <div>
              <Label>Contact name</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? 'Starting…' : 'Start handover'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Send this acceptance link to <strong>{email}</strong>:</p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(link); toast.success('Copied'); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              No email was sent automatically — deliver this link yourself. The account stays
              caretaker-locked (Stripe onboarding blocked) until they accept.
            </p>
            <Button className="w-full" onClick={() => { setOpen(false); setLink(null); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default WholesalerTransferDialog;
