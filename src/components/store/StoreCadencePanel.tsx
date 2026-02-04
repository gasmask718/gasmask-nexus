// ═══════════════════════════════════════════════════════════════════════════════
// STORE CADENCE PANEL
// Shows contact cadence intelligence for a single store
// This is a LENS into the global cadence system, not a separate system
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle, Clock, AlertTriangle, MapPin, UserX, Users,
  Phone, MessageSquare, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { useStoreCadenceIntelligence, useStoreCadenceStats } from '@/hooks/useStoreCadenceIntelligence';
import type { CadenceFilter, ContactCadenceItem } from '@/hooks/useContactCadence';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface StoreCadencePanelProps {
  storeId: string;
  storeName?: string;
  className?: string;
}

export function StoreCadencePanel({ storeId, storeName, className }: StoreCadencePanelProps) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<CadenceFilter>('all');
  const [expanded, setExpanded] = useState(false);

  const { data: stats, isLoading: statsLoading } = useStoreCadenceStats(storeId);
  const { data: contacts, isLoading: contactsLoading } = useStoreCadenceIntelligence(storeId, activeFilter);

  const statCards = [
    {
      filter: 'within_window' as CadenceFilter,
      label: 'On Track',
      value: stats?.withinWindow || 0,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      filter: 'due_soon' as CadenceFilter,
      label: 'Due Soon',
      value: stats?.dueSoon || 0,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      filter: 'overdue_7_days' as CadenceFilter,
      label: 'Overdue 7d',
      value: stats?.overdue7Days || 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      filter: 'overdue_14_days' as CadenceFilter,
      label: 'Overdue 14d+',
      value: stats?.overdue14Days || 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      filter: 'escalation' as CadenceFilter,
      label: 'Needs Visit',
      value: stats?.escalationRequired || 0,
      icon: MapPin,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      filter: 'never_contacted' as CadenceFilter,
      label: 'Never Contacted',
      value: stats?.neverContacted || 0,
      icon: UserX,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ];

  const handleViewGlobalBoard = () => {
    // Navigate to global cadence board with store filter pre-applied
    navigate(`/communication/follow-ups?store=${storeId}`);
  };

  if (statsLoading) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Contact Cadence
            <Badge variant="outline" className="ml-2 text-xs">
              {stats?.total || 0} contacts
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewGlobalBoard}
              title="View in Global Cadence Board"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Global View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Cadence Stats Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isActive = activeFilter === card.filter;

            return (
              <button
                key={card.filter}
                onClick={() => {
                  setActiveFilter(card.filter);
                  if (!expanded && card.value > 0) setExpanded(true);
                }}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
                  isActive
                    ? "border-primary bg-primary/10"
                    : "border-border/50 hover:border-primary/50",
                  card.bgColor
                )}
              >
                <Icon className={cn("h-4 w-4 mb-1", card.color)} />
                <span className={cn("text-xl font-bold", card.color)}>
                  {card.value}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Expanded Contact List */}
        {expanded && (
          <div className="mt-4 pt-4 border-t">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !contacts?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No contacts match this filter</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <CadenceContactRow key={contact.contact_id} contact={contact} />
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

interface CadenceContactRowProps {
  contact: ContactCadenceItem;
}

function CadenceContactRow({ contact }: CadenceContactRowProps) {
  const getCadenceStatusBadge = (status: string) => {
    switch (status) {
      case 'within_window':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">On Track</Badge>;
      case 'due_soon':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">Due Soon</Badge>;
      case 'overdue_7_days':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-xs">Overdue 7d</Badge>;
      case 'overdue_14_days':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">Overdue 14d+</Badge>;
      case 'never_contacted':
        return <Badge variant="outline" className="text-xs">Never Contacted</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  const getResponsivenessIcon = () => {
    if (contact.responsive_by_call && contact.responsive_by_text) {
      return (
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3 text-green-500" />
          <MessageSquare className="h-3 w-3 text-green-500" />
        </div>
      );
    }
    if (contact.responsive_by_call) {
      return <Phone className="h-3 w-3 text-green-500" />;
    }
    if (contact.responsive_by_text) {
      return <MessageSquare className="h-3 w-3 text-green-500" />;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const formatLastTouch = () => {
    if (contact.days_since_last_touch >= 999) {
      return 'Never';
    }
    const date = new Date(contact.last_touch_at);
    if (date.getFullYear() === 1970) {
      return 'Never';
    }
    return formatDistanceToNow(date, { addSuffix: true });
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30 gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{contact.contact_name}</span>
          {contact.is_primary && (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              Primary
            </Badge>
          )}
          {getCadenceStatusBadge(contact.cadence_status)}
          {contact.escalation_flag && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              Visit
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{contact.phone || 'No phone'}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatLastTouch()}
          </span>
          <span className="flex items-center gap-1">
            Responds: {getResponsivenessIcon()}
          </span>
        </div>
      </div>
    </div>
  );
}
