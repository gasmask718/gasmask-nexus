/**
 * SendInvoiceDialog — Channel-aware invoice send dialog.
 * Lets the user pick Email or SMS (text), confirm/override the recipient,
 * and dispatches via the va-send-invoice edge function.
 *
 * Used by:
 *  - /va/dashboard       → VAInvoicesTable
 *  - /crm/brandaro       → BrandaroInvoicesDataTable
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmsProviderSelect } from '@/components/communication/SmsProviderSelect';
import { Mail, MessageSquare, Send, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Channel = 'email' | 'sms';

interface Props {
  open: boolean;
  onClose: () => void;
  invoice: any | null;
  /** Optional react-query keys to invalidate on success (defaults to common invoice keys). */
  invalidateKeys?: (string | undefined | null)[][];
}

function normalizeUSPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return digits ? '+' + digits : '';
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const isE164 = (s: string) => /^\+\d{8,15}$/.test(s.trim());

export function SendInvoiceDialog({ open, onClose, invoice, invalidateKeys }: Props) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<Channel>('email');
  const [recipient, setRecipient] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('twilio');

  // Default channel + recipient whenever the invoice changes
  useEffect(() => {
    if (!open || !invoice) return;
    const email = invoice.customer_email || '';
    const phone = normalizeUSPhone(invoice.customer_phone || invoice.lead_phone || '');
    const next: Channel = email ? 'email' : phone ? 'sms' : 'email';
    setChannel(next);
    setRecipient(next === 'email' ? email : phone);
    setSelectedProvider('twilio');
  }, [open, invoice]);

  // Switching channel auto-fills the appropriate recipient
  const switchChannel = (next: Channel) => {
    setChannel(next);
    if (!invoice) return;
    if (next === 'email') {
      setRecipient(invoice.customer_email || '');
    } else {
      setRecipient(normalizeUSPhone(invoice.customer_phone || invoice.lead_phone || ''));
    }
  };

  const recipientValid = useMemo(() => {
    if (!recipient.trim()) return false;
    return channel === 'email' ? isEmail(recipient) : isE164(recipient);
  }, [channel, recipient]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error('No invoice selected');
      if (!recipientValid) {
        throw new Error(channel === 'email'
          ? 'Enter a valid email address'
          : 'Enter a valid phone number in international format (e.g. +15551234567)');
      }
      const { data, error } = await supabase.functions.invoke('va-send-invoice', {
        body: {
          invoice_id: invoice.id,
          channel,
          recipient: recipient.trim(),
          explicit_provider: channel === 'sms' && selectedProvider !== 'default' ? selectedProvider : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Invoice sent via ${channel === 'sms' ? 'text message' : 'email'} to ${data?.sent_to || recipient}`
      );
      const keys = invalidateKeys ?? [
        ['va-invoices'],
        ['brandaro-invoices-table'],
        ['va-invoice-logs', invoice?.id],
      ];
      keys.forEach(k => qc.invalidateQueries({ queryKey: k as any }));
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to send invoice'),
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : ''}
          </DialogTitle>
          <DialogDescription>
            Choose how to deliver this invoice to{' '}
            <span className="font-medium text-foreground">{invoice.customer_name || 'the customer'}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchChannel('email')}
              className={`group rounded-xl border-2 p-3 text-left transition-all ${
                channel === 'email'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-border hover:border-cyan-500/40 hover:bg-muted/50'
              }`}
            >
              <Mail className={`h-5 w-5 mb-1 ${channel === 'email' ? 'text-cyan-600' : 'text-muted-foreground'}`} />
              <div className="text-sm font-semibold">Email</div>
              <div className="text-[11px] text-muted-foreground">HTML invoice with pay button</div>
            </button>
            <button
              type="button"
              onClick={() => switchChannel('sms')}
              className={`group rounded-xl border-2 p-3 text-left transition-all ${
                channel === 'sms'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border hover:border-emerald-500/40 hover:bg-muted/50'
              }`}
            >
              <MessageSquare className={`h-5 w-5 mb-1 ${channel === 'sms' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <div className="text-sm font-semibold">Text Message</div>
              <div className="text-[11px] text-muted-foreground">SMS with payment link</div>
            </button>
          </div>

          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-recipient" className="text-xs">
              {channel === 'email' ? 'Recipient email' : 'Recipient phone number'}
            </Label>
            <Input
              id="invoice-recipient"
              type={channel === 'email' ? 'email' : 'tel'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === 'email' ? 'customer@example.com' : '+15551234567'}
              autoComplete="off"
            />
            {!recipientValid && recipient.trim() !== '' && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {channel === 'email' ? 'Not a valid email address' : 'Use international format, e.g. +15551234567'}
              </p>
            )}
            {channel === 'sms' && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  US numbers will be auto-prefixed with +1 if missing.
                </p>
                <SmsProviderSelect
                  value={selectedProvider}
                  onChange={setSelectedProvider}
                  showLabel={false}
                />
              </div>
            )}
          </div>

          {/* Summary chip */}
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono font-semibold text-emerald-600">
              ${Number(invoice.total ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!recipientValid || sendMutation.isPending}
            className={channel === 'sms' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-cyan-600 hover:bg-cyan-500'}
          >
            {sendMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
            ) : (
              <>
                {channel === 'sms' ? <MessageSquare className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Send via {channel === 'sms' ? 'SMS' : 'Email'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
