import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Users, Phone, MessageSquare, CheckCircle2, XCircle, HelpCircle, 
  Search, Filter, ChevronDown, ChevronRight
} from 'lucide-react';
import { useContactResponsiveness, useContactResponsivenessSummary, ContactResponsivenessStats } from '@/hooks/useContactResponsiveness';
import { ContactResponsivenessBadge } from '@/components/contact/ContactResponsivenessBadge';
import { ContactLastInteraction } from '@/components/contact/ContactLastInteraction';
import { cn } from '@/lib/utils';
import { useCall } from '@/components/communication/CallProvider';
import { useMessage } from '@/components/communication/MessageProvider';
import { toast } from 'sonner';

interface QuickStatsContactResponsivenessProps {
  storeId?: string;
  className?: string;
}

type FilterType = 'all' | 'responsive' | 'unresponsive' | 'never_contacted';

export function QuickStatsContactResponsiveness({ storeId, className }: QuickStatsContactResponsivenessProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  
  const { data: contacts, isLoading } = useContactResponsiveness(storeId);
  const { data: summary } = useContactResponsivenessSummary();
  const { initiateCall } = useCall();
  const { initiateMessage } = useMessage();

  const handleCall = (phone: string | null, name: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    initiateCall({
      destinationPhone: phone,
      entityType: 'customer',
      entityName: name,
    });
  };

  const handleText = (phone: string | null, name: string, contactId: string, storeId: string) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    initiateMessage({
      destinationPhone: phone,
      entityType: 'customer',
      entityId: contactId,
      storeId: storeId,
      entityName: name,
      channel: 'sms',
    });
  };

  const filteredContacts = (contacts || []).filter((contact) => {
    // Search filter
    const matchesSearch = !searchQuery || 
      contact.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.includes(searchQuery);

    if (!matchesSearch) return false;

    // Status filter
    switch (activeFilter) {
      case 'responsive':
        return contact.responsiveness_status === 'responsive';
      case 'unresponsive':
        return contact.responsiveness_status === 'unresponsive';
      case 'never_contacted':
        return contact.responsiveness_status === 'unknown' && 
               (contact.total_calls_attempted === 0) && 
               (contact.total_texts_sent === 0);
      default:
        return true;
    }
  });

  const statCards = [
    { 
      key: 'all' as FilterType, 
      label: 'Total', 
      count: summary?.total || 0, 
      icon: Users, 
      color: 'text-foreground',
      bgColor: 'bg-muted/50',
    },
    { 
      key: 'responsive' as FilterType, 
      label: 'Responsive', 
      count: summary?.responsive || 0, 
      icon: CheckCircle2, 
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    { 
      key: 'unresponsive' as FilterType, 
      label: 'Not Responding', 
      count: summary?.unresponsive || 0, 
      icon: XCircle, 
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    { 
      key: 'never_contacted' as FilterType, 
      label: 'Never Contacted', 
      count: summary?.neverContacted || 0, 
      icon: HelpCircle, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/30',
    },
  ];

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Contact Responsiveness
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {statCards.map((stat) => (
            <button
              key={stat.key}
              onClick={() => {
                setActiveFilter(stat.key);
                if (!expanded && stat.count > 0) setExpanded(true);
              }}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border transition-all",
                activeFilter === stat.key 
                  ? "border-primary bg-primary/10" 
                  : "border-border/50 hover:border-primary/50",
                stat.bgColor
              )}
            >
              <stat.icon className={cn("h-5 w-5 mb-1", stat.color)} />
              <span className="text-2xl font-bold">{stat.count}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </button>
          ))}
        </div>

        {/* Expanded Contact List */}
        {expanded && (
          <div className="space-y-3 mt-4 pt-4 border-t">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Results */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No contacts match the filter</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <ContactResponsivenessRow 
                      key={contact.contact_id} 
                      contact={contact}
                      onCall={handleCall}
                      onText={handleText}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ContactResponsivenessRowProps {
  contact: ContactResponsivenessStats;
  onCall: (phone: string | null, name: string) => void;
  onText: (phone: string | null, name: string, contactId: string, storeId: string) => void;
}

function ContactResponsivenessRow({ contact, onCall, onText }: ContactResponsivenessRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30 gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{contact.contact_name}</span>
          {contact.is_primary && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              Primary
            </Badge>
          )}
          <ContactResponsivenessBadge
            responsiveness_status={contact.responsiveness_status}
            responsive_by_call={contact.responsive_by_call}
            responsive_by_text={contact.responsive_by_text}
            last_call_attempt_at={contact.last_call_attempt_at}
            last_call_answered_at={contact.last_call_answered_at}
            last_text_sent_at={contact.last_text_sent_at}
            last_text_received_at={contact.last_text_received_at}
            total_calls_attempted={contact.total_calls_attempted}
            total_calls_answered={contact.total_calls_answered}
            total_texts_sent={contact.total_texts_sent}
            total_texts_received={contact.total_texts_received}
            compact
          />
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {contact.store_name} • {contact.phone || 'No phone'}
        </div>
        <ContactLastInteraction
          last_call_attempt_at={contact.last_call_attempt_at}
          last_call_answered_at={contact.last_call_answered_at}
          last_text_sent_at={contact.last_text_sent_at}
          last_text_received_at={contact.last_text_received_at}
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCall(contact.phone, contact.contact_name)}
          disabled={!contact.phone}
          title="Call"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onText(contact.phone, contact.contact_name, contact.contact_id, contact.store_id)}
          disabled={!contact.phone}
          title="Text"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
