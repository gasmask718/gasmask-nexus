/**
 * Invoice Receipt Audit Panel
 * Shows complete delivery audit trail for invoice receipts
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Phone, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { ReceiptStatusIndicator, type ReceiptStatus } from './ReceiptStatusIndicator';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface InvoiceReceiptPanelProps {
  receiptStatus: ReceiptStatus;
  receiptSentAt?: string | null;
  receiptDeliveredAt?: string | null;
  receiptFailureReason?: string | null;
  receiptPhoneUsed?: string | null;
  receiptMessageSid?: string | null;
  className?: string;
}

export function InvoiceReceiptPanel({
  receiptStatus,
  receiptSentAt,
  receiptDeliveredAt,
  receiptFailureReason,
  receiptPhoneUsed,
  receiptMessageSid,
  className,
}: InvoiceReceiptPanelProps) {
  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return null;
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return null;
    }
  };

  const effectiveStatus = receiptStatus || 'not_sent';

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" />
          Receipt Delivery Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current Status</span>
          <ReceiptStatusIndicator
            status={receiptStatus}
            sentAt={receiptSentAt}
            deliveredAt={receiptDeliveredAt}
            failureReason={receiptFailureReason}
            phoneUsed={receiptPhoneUsed}
            showLabel
          />
        </div>

        {/* Timeline */}
        <div className="space-y-3 pt-2 border-t">
          {/* Sent event */}
          {receiptSentAt && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Receipt Sent</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(receiptSentAt)}
                </p>
              </div>
            </div>
          )}

          {/* Delivered event */}
          {receiptDeliveredAt && effectiveStatus === 'delivered' && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Delivered</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(receiptDeliveredAt)}
                </p>
              </div>
            </div>
          )}

          {/* Failed event */}
          {effectiveStatus === 'failed' && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Delivery Failed</p>
                {receiptFailureReason && (
                  <p className="text-xs text-destructive">
                    {receiptFailureReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Suppressed/Skipped event */}
          {(effectiveStatus === 'suppressed' || effectiveStatus === 'skipped') && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {effectiveStatus === 'suppressed' ? 'Historical Record' : 'Receipt Skipped'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {effectiveStatus === 'suppressed' 
                    ? 'Automation disabled for historical data'
                    : 'No phone number available'}
                </p>
              </div>
            </div>
          )}

          {/* Not sent state */}
          {effectiveStatus === 'not_sent' && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Not Yet Sent</p>
                <p className="text-xs text-muted-foreground">
                  Receipt text has not been sent
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Phone used */}
        {receiptPhoneUsed && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Sent to: {receiptPhoneUsed}
            </span>
          </div>
        )}

        {/* Message SID for debugging */}
        {receiptMessageSid && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground font-mono">
              SID: {receiptMessageSid}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}