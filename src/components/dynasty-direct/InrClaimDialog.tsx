import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  orderId: string;
  email: string;
  /** The address as the carrier has it, prefilled so the customer can correct it. */
  shippingAddress?: Record<string, unknown> | null;
}

/**
 * "It never arrived" — deliberately NOT the returns dialog.
 * A return is "I got it and want to send it back". This is a loss claim: it
 * captures the evidence the admin needs (expected date, whether they checked
 * with neighbours, the address the carrier has) and the server pulls the
 * carrier's own tracking record the moment it's submitted.
 */
export function InrClaimDialog({ orderId, email, shippingAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expected, setExpected] = useState('');
  const [checked, setChecked] = useState(false);
  const [checkedNotes, setCheckedNotes] = useState('');
  const [note, setNote] = useState('');
  const addr = (shippingAddress ?? {}) as Record<string, string>;
  const [street1, setStreet1] = useState(addr.street1 ?? addr.address_line_1 ?? '');
  const [street2, setStreet2] = useState(addr.street2 ?? addr.address_line_2 ?? '');
  const [city, setCity] = useState(addr.city ?? '');
  const [state, setState] = useState(addr.state ?? '');
  const [zip, setZip] = useState(addr.zip ?? addr.postal_code ?? '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('dd-inr-claim', {
      body: {
        order_id: orderId,
        email,
        expected_delivery_date: expected || null,
        checked_with_neighbours: checked,
        checked_notes: checkedNotes || null,
        note: note || null,
        stated_address: { street1, street2, city, state, zip },
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error("We couldn't file that claim. Try again in a moment.");
      return;
    }
    const res = data as Record<string, unknown> | null;
    if (!res || Object.keys(res).length === 0) {
      toast.error("We couldn't match that order and email.");
      return;
    }
    if (res.already_open) {
      toast.info(String(res.message ?? 'A claim is already open on this order.'));
      setOpen(false);
      return;
    }
    if (res.error) {
      toast.error(String(res.message ?? 'That claim could not be filed.'));
      return;
    }
    toast.success(`Claim ${String(res.claim_number)} filed`, {
      description: String(res.message ?? ''),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PackageX className="h-4 w-4 mr-2" />
          It never arrived
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report an order you didn't receive</DialogTitle>
          <DialogDescription>
            We'll pull the carrier's own delivery record for this parcel as soon as you submit, so
            please be exact — it's the evidence we work from.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="expected">When did you expect it?</Label>
            <Input
              id="expected"
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              required
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="checked"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="checked" className="cursor-pointer">
                I've checked with neighbours, the building, and around the property
              </Label>
              <p className="text-xs text-muted-foreground">
                Most "missing" parcels turn up at a neighbour or a back door. Checking first gets
                your claim resolved faster.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkedNotes">Where did you check? (optional)</Label>
            <Input
              id="checkedNotes"
              value={checkedNotes}
              onChange={(e) => setCheckedNotes(e.target.value)}
              placeholder="Front porch, side gate, apartment office, next door…"
            />
          </div>

          <div className="space-y-2">
            <Label>Delivery address as the carrier has it</Label>
            <Input value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="Street address" required />
            <Input value={street2} onChange={(e) => setStreet2(e.target.value)} placeholder="Apt / unit (optional)" />
            <div className="grid grid-cols-3 gap-2">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" required />
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" required />
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Anything else we should know?</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Tracking says delivered but nothing came, no delivery attempt notice, etc."
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              File claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InrClaimDialog;
