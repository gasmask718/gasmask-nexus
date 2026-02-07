/**
 * QuickStatsContactSnapshot — Compact contact responsiveness summary
 * 
 * Placement: Store Profile → Quick Stats card → below Responsiveness row
 * Purpose: "Who at this store actually responds — and how?" in under 2 seconds.
 * 
 * READ-ONLY. No filters, no edit actions, no deep analytics.
 * For the full cadence view, see the Communication Cadence section.
 */

import { Phone, MessageSquare, CheckCircle2, XCircle, HelpCircle, Users } from 'lucide-react';
import { useStoreContactsWithResponsiveness } from '@/hooks/useContactResponsiveness';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_CONTACTS = 3;

interface QuickStatsContactSnapshotProps {
  storeId: string;
}

export function QuickStatsContactSnapshot({ storeId }: QuickStatsContactSnapshotProps) {
  const { data: contacts, isLoading } = useStoreContactsWithResponsiveness(storeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-muted/30 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/20 border border-border/30">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">No contacts on file</span>
        </div>
      </div>
    );
  }

  const visibleContacts = contacts.slice(0, MAX_VISIBLE_CONTACTS);
  const remainingCount = contacts.length - MAX_VISIBLE_CONTACTS;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Contact Responsiveness</p>
      <div className="space-y-1.5">
        {visibleContacts.map((contact) => (
          <ContactSnapshotRow
            key={contact.id}
            name={contact.name}
            phone={contact.phone}
            responsiveByText={contact.responsive_by_text}
            responsiveByCall={contact.responsive_by_call}
            status={contact.responsiveness_status as 'responsive' | 'unresponsive' | 'unknown' | null}
          />
        ))}
        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground pl-1">
            + {remainingCount} more contact{remainingCount > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

interface ContactSnapshotRowProps {
  name: string;
  phone: string | null;
  responsiveByText: boolean | null;
  responsiveByCall: boolean | null;
  status: 'responsive' | 'unresponsive' | 'unknown' | null;
}

function ContactSnapshotRow({ name, phone, responsiveByText, responsiveByCall, status }: ContactSnapshotRowProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30 text-xs">
      {/* Name + Phone */}
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{name}</span>
        {phone && (
          <span className="text-muted-foreground truncate block">{phone}</span>
        )}
      </div>

      {/* Text status */}
      <div className="flex items-center gap-1 shrink-0" title={`Text: ${getStatusLabel(responsiveByText, status)}`}>
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByText} overallStatus={status} />
      </div>

      {/* Call status */}
      <div className="flex items-center gap-1 shrink-0" title={`Call: ${getStatusLabel(responsiveByCall, status)}`}>
        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        <StatusIcon value={responsiveByCall} overallStatus={status} />
      </div>
    </div>
  );
}

function StatusIcon({ value, overallStatus }: { value: boolean | null; overallStatus: 'responsive' | 'unresponsive' | 'unknown' | null }) {
  if (value === true) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (value === false) {
    return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  }
  // null = no data yet
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getStatusLabel(value: boolean | null, overallStatus: 'responsive' | 'unresponsive' | 'unknown' | null): string {
  if (value === true) return 'Responsive';
  if (value === false) return 'Not responsive';
  return 'No data';
}
