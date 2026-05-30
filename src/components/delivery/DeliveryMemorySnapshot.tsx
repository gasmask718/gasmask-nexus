import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, User, DollarSign, AlertTriangle, Clock, StickyNote, Phone, MessageSquare, Star } from 'lucide-react';
import { useDeliveryMemorySnapshot } from '@/hooks/useDeliveryMemorySnapshot';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { PinnedNotesSnapshotPanel } from './PinnedNotesSnapshotPanel';
import { EscalationFlagsPanel } from './EscalationFlagsPanel';

interface DeliveryMemorySnapshotProps {
  storeId: string;
  storeName?: string;
}

export function DeliveryMemorySnapshot({ storeId, storeName }: DeliveryMemorySnapshotProps) {
  const { data: snapshot, isLoading } = useDeliveryMemorySnapshot(storeId);

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-5 bg-muted rounded w-2/3" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) return null;

  const { contacts, payment, recentNotes, lastVisitDate } = snapshot;
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
  const hasOutstanding = payment.total_outstanding > 0;

  return (
    <Card className={cn(
      'border-2',
      hasOutstanding ? 'border-amber-500/50 bg-amber-500/5' : 'border-primary/30 bg-primary/5'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">DO NOT WALK IN BLIND</h3>
          <Badge variant="outline" className="text-[10px]">Memory Snapshot</Badge>
        </div>

        {/* Pinned Notes — ALWAYS ABOVE EVERYTHING */}
        <PinnedNotesSnapshotPanel storeId={storeId} />

        {/* Escalation Flags — Read-only derived signals */}
        <EscalationFlagsPanel storeId={storeId} />

        {/* Last Visit */}
        {lastVisitDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last visit: {formatDistanceToNow(new Date(lastVisitDate), { addSuffix: true })}
          </div>
        )}

        {/* Payment Recall — ALWAYS VISIBLE */}
        <div className={cn(
          'p-2.5 rounded-lg border',
          hasOutstanding
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-emerald-500/10 border-emerald-500/30'
        )}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Payment Recall</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Outstanding</span>
              <p className={cn('font-bold', hasOutstanding ? 'text-amber-600' : 'text-emerald-600')}>
                {hasOutstanding
                  ? `$${payment.total_outstanding.toFixed(2)} (${payment.outstanding_invoice_count} inv)`
                  : '$0 — Clear'
                }
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Payment</span>
              <p className="font-medium">
                {payment.last_payment_date
                  ? `$${payment.last_payment_amount?.toFixed(2)} · ${format(new Date(payment.last_payment_date), 'MMM d, yyyy')}`
                  : 'No payments on record'
                }
              </p>
            </div>
          </div>
          {payment.last_paid_by && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Received by: {payment.last_paid_by}
            </p>
          )}
        </div>

        {/* Contacts — Who you're talking to */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              People ({contacts.length})
            </span>
          </div>
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              No contacts on file — capture today
            </p>
          ) : (
            <div className="space-y-1">
              {contacts.slice(0, 4).map((contact) => (
                <div
                  key={contact.id}
                  className={cn(
                    'flex items-center justify-between p-1.5 rounded text-xs',
                    contact.is_primary ? 'bg-primary/10' : 'bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {contact.is_primary && <Star className="h-3 w-3 text-primary shrink-0" />}
                    <span className="font-medium truncate">{contact.name}</span>
                    {contact.role && (
                      <Badge variant="outline" className="text-[9px] shrink-0">{contact.role}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {contact.responsive_by_call && (
                      <Phone className="h-3 w-3 text-emerald-500" />
                    )}
                    {contact.responsive_by_text && (
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                    )}
                    {contact.responsiveness_status === 'responsive' && (
                      <Badge className="text-[8px] bg-emerald-500/20 text-emerald-600 px-1">Responsive</Badge>
                    )}
                    {contact.responsiveness_status === 'unresponsive' && (
                      <Badge className="text-[8px] bg-red-500/20 text-red-600 px-1">Unresponsive</Badge>
                    )}
                  </div>
                </div>
              ))}
              {contacts.length > 4 && (
                <p className="text-[10px] text-muted-foreground">+{contacts.length - 4} more contacts</p>
              )}
            </div>
          )}
          {/* Contact-specific notes (inline) */}
          {primaryContact?.notes && (
            <div className="p-1.5 rounded bg-muted/50 text-[10px] text-muted-foreground border-l-2 border-primary/30">
              <span className="font-medium">{primaryContact.name}:</span> {primaryContact.notes}
            </div>
          )}
        </div>

        {/* Red Flags / Store Notes */}
        {recentNotes.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Notes
              </span>
            </div>
            {recentNotes.map((note) => (
              <div key={note.id} className="p-1.5 rounded bg-muted/30 text-xs">
                <span className="text-muted-foreground">{note.note_text}</span>
                <span className="text-[9px] text-muted-foreground/60 ml-1">
                  · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
