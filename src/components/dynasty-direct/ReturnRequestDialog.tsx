import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, PackageX, CheckCircle2, AlertTriangle } from 'lucide-react';

const REASONS: { value: string; label: string; fault: boolean }[] = [
  { value: 'wrong_item', label: 'Wrong item was sent', fault: true },
  { value: 'damaged', label: 'Arrived damaged', fault: true },
  { value: 'defective', label: "Doesn't work / defective", fault: true },
  { value: 'not_as_described', label: 'Not as described', fault: true },
  { value: 'missing_items', label: 'Items missing from the box', fault: true },
  { value: 'changed_mind', label: 'Changed my mind', fault: false },
  { value: 'arrived_late', label: 'Arrived too late', fault: false },
  { value: 'other', label: 'Something else', fault: false },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  orderId: string;
  /** Email used at checkout — this is what proves ownership of the order. */
  email: string;
  trigger?: React.ReactNode;
}

/**
 * Customer-facing return (RMA) request.
 * Ownership is proven server-side by the order id + checkout email pair, the
 * same contract /track uses — so this works for guests as well as accounts.
 */
export function ReturnRequestDialog({ orderId, email, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [qty, setQty] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const faulty = REASONS.find((r) => r.value === reason)?.fault ?? false;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const photos = await Promise.all(files.slice(0, 4).map(fileToDataUrl));
      const { data, error: fnErr } = await supabase.functions.invoke('dd-return-request', {
        body: {
          order_id: orderId,
          email,
          reason_code: reason,
          reason_text: detail || null,
          quantity: qty,
          photos,
        },
      });
      if (fnErr) throw fnErr;
      if (!data || Object.keys(data).length === 0) {
        setError("We couldn't match that order to this email. Check the address you used at checkout.");
        return;
      }
      if (data.error && !data.already_open) {
        setError(data.message ?? data.error);
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong sending the request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setResult(null); setError(null); }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PackageX className="h-4 w-4 mr-2" /> Return an item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            Tell us what's wrong. We review every request and email you a return label if it's approved.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {result.already_open
                  ? `There's already an open return on this order (${result.rma_number}).`
                  : `Return ${result.rma_number} received. We'll email you once it's reviewed.`}
              </AlertDescription>
            </Alert>
            {result.shipping_paid_by && (
              <p className="text-sm text-muted-foreground">
                {result.shipping_paid_by === 'customer'
                  ? 'For this reason, return shipping is paid by you.'
                  : 'Return shipping is on us — the label will be prepaid.'}
              </p>
            )}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Pick the closest reason" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rma-qty">How many items?</Label>
              <Input
                id="rma-qty" type="number" min={1} value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rma-detail">What happened?</Label>
              <Textarea
                id="rma-detail" rows={3} value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="A sentence or two is plenty."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rma-photos">Photos {faulty && <span className="text-muted-foreground">— these speed up approval a lot</span>}</Label>
              <Input
                id="rma-photos" type="file" accept="image/*" multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
              />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground">{files.length} photo(s) attached (max 4).</p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!reason || submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send request
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReturnRequestDialog;
