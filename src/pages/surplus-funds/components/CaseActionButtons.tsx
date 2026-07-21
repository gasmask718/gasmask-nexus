import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileSignature, Scale, DollarSign, Loader2 } from 'lucide-react';

interface CaseActionButtonsProps {
  case: any;
  className?: string;
}

const CONTRACT_SENT_OR_LATER = new Set([
  'agreement_sent', 'agreement_signed', 'referred', 'filed',
  'hearing_scheduled', 'approved', 'funds_released', 'paid', 'closed',
]);

export function CaseActionButtons({ case: sfCase, className }: CaseActionButtonsProps) {
  const qc = useQueryClient();
  const caseId = sfCase?.id;

  const [attorneyOpen, setAttorneyOpen] = useState(false);
  const [attorneyId, setAttorneyId] = useState<string>(sfCase?.attorney_id ?? '');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sf-cases'] });
    qc.invalidateQueries({ queryKey: ['sf-case-for-lead'] });
    qc.invalidateQueries({ queryKey: ['sf-payments', caseId] });
    qc.invalidateQueries({ queryKey: ['sf-lead-summary'] });
  };

  // Send Contract
  const sendContract = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sf-send-contract', {
        body: { case_id: caseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success('Contract sent'); invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to send contract'),
  });

  // Attorneys list (active only)
  const { data: attorneys = [] } = useQuery({
    queryKey: ['sf-attorneys-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surplus_funds_attorneys')
        .select('id, name, firm, states, status')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: attorneyOpen,
  });

  const assignAttorney = useMutation({
    mutationFn: async () => {
      if (!attorneyId) throw new Error('Select an attorney');
      const { data, error } = await supabase.functions.invoke('sf-assign-attorney', {
        body: { case_id: caseId, attorney_id: attorneyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Attorney assigned');
      setAttorneyOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to assign attorney'),
  });

  const logPayment = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a valid amount');
      const { data, error } = await supabase.functions.invoke('sf-payment-handler', {
        body: { case_id: caseId, amount: n, notes: paymentNotes || undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Payment logged');
      setPaymentOpen(false);
      setAmount('');
      setPaymentNotes('');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to log payment'),
  });

  if (!caseId) return null;

  const contractAlreadySent = CONTRACT_SENT_OR_LATER.has(sfCase.status);

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => sendContract.mutate()}
        disabled={sendContract.isPending || contractAlreadySent}
        title={contractAlreadySent ? 'Contract already sent' : undefined}
      >
        {sendContract.isPending
          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          : <FileSignature className="h-4 w-4 mr-2" />}
        {contractAlreadySent ? 'Contract Sent' : 'Send Contract'}
      </Button>

      <Button size="sm" variant="outline" onClick={() => setAttorneyOpen(true)}>
        <Scale className="h-4 w-4 mr-2" />
        {sfCase.attorney_name ? 'Reassign Attorney' : 'Assign Attorney'}
      </Button>

      <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
        <DollarSign className="h-4 w-4 mr-2" />
        Log Payment
      </Button>

      {/* Assign Attorney Modal */}
      <Dialog open={attorneyOpen} onOpenChange={setAttorneyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Attorney</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {sfCase.attorney_name && (
              <p className="text-xs text-muted-foreground">
                Currently: <span className="font-medium text-foreground">{sfCase.attorney_name}</span>
              </p>
            )}
            <div>
              <Label>Attorney</Label>
              <Select value={attorneyId} onValueChange={setAttorneyId}>
                <SelectTrigger><SelectValue placeholder="Select an active attorney" /></SelectTrigger>
                <SelectContent>
                  {attorneys.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">No active attorneys</div>
                  )}
                  {attorneys.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.firm ? ` — ${a.firm}` : ''}
                      {a.states?.length ? ` (${a.states.join(', ')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttorneyOpen(false)}>Cancel</Button>
            <Button onClick={() => assignAttorney.mutate()} disabled={assignAttorney.isPending || !attorneyId}>
              {assignAttorney.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Payment Modal */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Payment method, reference #, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button
              onClick={() => logPayment.mutate()}
              disabled={logPayment.isPending || !amount || Number(amount) <= 0}
            >
              {logPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
