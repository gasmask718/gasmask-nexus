import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Props {
  storeId: string;
  storeName?: string;
  defaultAmount?: number;
  invoiceId?: string | null;
  size?: 'sm' | 'default';
  variant?: 'default' | 'destructive' | 'secondary';
  className?: string;
}

/**
 * Field-rep inline action: records a `field_collection_pings` row.
 * This is the rep's word that money was collected — office reconciles
 * against the canonical invoice payment_status separately.
 */
export function MarkCollectedButton({
  storeId,
  storeName,
  defaultAmount,
  invoiceId,
  size = 'sm',
  variant = 'default',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(defaultAmount ? defaultAmount.toFixed(2) : '');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not signed in');
      const { error } = await supabase.from('field_collection_pings').insert({
        store_id: storeId,
        invoice_id: invoiceId ?? null,
        amount: amount ? Number(amount) : null,
        method,
        note: note || null,
        collected_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Collection recorded',
        description: `Office will reconcile against the invoice${storeName ? ` for ${storeName}` : ''}.`,
      });
      qc.invalidateQueries({ queryKey: ['store-payment-status-map'] });
      qc.invalidateQueries({ queryKey: ['field-collection-pings'] });
      setOpen(false);
      setNote('');
    },
    onError: (e: any) => {
      toast({
        title: 'Could not record collection',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <DollarSign className="h-3.5 w-3.5 mr-1" />
        Mark Collected
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Record collection{storeName ? ` — ${storeName}` : ''}</DialogTitle>
            <DialogDescription>
              Logs your in-person pickup. Office reconciles this against the invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="fcp-amount">Amount collected</Label>
              <Input
                id="fcp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="cashapp">Cash App</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fcp-note">Note (optional)</Label>
              <Textarea
                id="fcp-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Check #, partial pickup, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Confirm collected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
