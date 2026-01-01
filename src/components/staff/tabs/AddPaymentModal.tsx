/**
 * AddPaymentModal
 * 
 * SYSTEM LAW: Payments are financial truth.
 * Add real payment records to ut_staff_payments.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { useCreateStaffPayment, UTStaffPayment, useStaffEvents } from '@/hooks/useUnforgettableStaffTabs';

interface AddPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
}

export default function AddPaymentModal({ open, onOpenChange, staffId }: AddPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<UTStaffPayment['status']>('pending');
  const [paymentType, setPaymentType] = useState<UTStaffPayment['payment_type']>('event');
  const [paymentMethod, setPaymentMethod] = useState<UTStaffPayment['payment_method']>('cash');
  const [eventId, setEventId] = useState<string | null>(null);
  const [paidDate, setPaidDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const { data: events } = useStaffEvents(staffId);
  const createPayment = useCreateStaffPayment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    await createPayment.mutateAsync({
      staff_id: staffId,
      business_slug: 'unforgettable_times_usa',
      amount: parseFloat(amount),
      status,
      payment_type: paymentType,
      payment_method: paymentMethod,
      event_id: eventId,
      event_staff_id: null,
      payment_date: paidDate ? format(paidDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      reference_number: null,
      notes: notes || null,
    });

    // Reset form and close
    setAmount('');
    setStatus('pending');
    setPaymentType('event');
    setPaymentMethod('cash');
    setEventId(null);
    setPaidDate(undefined);
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as UTStaffPayment['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as UTStaffPayment['payment_type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="reimbursement">Reimbursement</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod || 'cash'} onValueChange={(v) => setPaymentMethod(v as UTStaffPayment['payment_method'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                <SelectItem value="venmo">Venmo</SelectItem>
                <SelectItem value="zelle">Zelle</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Link to Event (optional)</Label>
            <Select value={eventId || 'none'} onValueChange={(v) => setEventId(v === 'none' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event</SelectItem>
                {events?.filter(e => e.event).map((assignment) => (
                  <SelectItem key={assignment.event_id} value={assignment.event_id}>
                    {assignment.event?.event_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {status === 'paid' && (
            <div className="space-y-2">
              <Label>Paid Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paidDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paidDate ? format(paidDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={paidDate}
                    onSelect={setPaidDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPayment.isPending || !amount}>
              {createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
