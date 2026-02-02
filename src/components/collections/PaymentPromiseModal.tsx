// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PROMISE MODAL — Create/Manage Promise-to-Pay
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePromiseMutations } from '@/hooks/usePaymentPromises';

interface PaymentPromiseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionAccountId: string;
  accountName?: string;
  currentBalance?: number;
}

export function PaymentPromiseModal({
  open,
  onOpenChange,
  collectionAccountId,
  accountName,
  currentBalance,
}: PaymentPromiseModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const { createPromise } = usePromiseMutations();

  const handleSubmit = async () => {
    if (!amount || !date) return;

    await createPromise.mutateAsync({
      collection_account_id: collectionAccountId,
      promise_amount: parseFloat(amount),
      promise_date: format(date, 'yyyy-MM-dd'),
      notes: notes || undefined,
    });

    // Reset form
    setAmount('');
    setDate(undefined);
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Payment Promise</DialogTitle>
          <DialogDescription>
            Record a promise-to-pay from {accountName || 'this account'}
            {currentBalance && (
              <span className="block mt-1 font-medium">
                Current Balance: ${currentBalance.toFixed(2)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Promise Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Promise Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about this promise..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!amount || !date || createPromise.isPending}
          >
            {createPromise.isPending ? 'Creating...' : 'Create Promise'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
