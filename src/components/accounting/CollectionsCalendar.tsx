import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, AlertTriangle, MapPin, Download, Loader2, CheckCircle, Phone } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, isThisWeek, differenceInDays } from 'date-fns';

interface CollectionEntry {
  id: string;
  entity_name: string;
  entity_type: string;
  total_outstanding: number;
  total_overdue: number;
  next_action_at: string | null;
  risk_tier: string;
  status: string;
  days_overdue: number;
  brand: string | null;
  notes: string | null;
}

function useCollections() {
  return useQuery({
    queryKey: ['collections-calendar'],
    queryFn: async (): Promise<CollectionEntry[]> => {
      const { data, error } = await supabase
        .from('collection_accounts')
        .select('*')
        .is('deleted_at', null)
        .neq('status', 'closed')
        .order('next_action_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(a => ({
        id: a.id,
        entity_name: a.entity_name || 'Unknown',
        entity_type: a.entity_type || 'store',
        total_outstanding: Number(a.total_outstanding || 0),
        total_overdue: Number(a.total_overdue || 0),
        next_action_at: a.next_action_at,
        risk_tier: a.risk_tier || 'low',
        status: a.status || 'active',
        days_overdue: a.max_days_overdue || 0,
        brand: a.primary_brand,
        notes: a.notes,
      }));
    },
  });
}

function getRiskColor(tier: string) {
  switch (tier) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
}

function getDateLabel(dateStr: string | null): { label: string; urgent: boolean } {
  if (!dateStr) return { label: 'No date set', urgent: false };
  const date = new Date(dateStr);
  if (isToday(date)) return { label: 'TODAY', urgent: true };
  if (isTomorrow(date)) return { label: 'Tomorrow', urgent: true };
  if (isThisWeek(date)) return { label: format(date, 'EEEE'), urgent: false };
  return { label: format(date, 'MMM d, yyyy'), urgent: false };
}

function exportCollectionsCSV(data: CollectionEntry[]) {
  const headers = ['Account', 'Type', 'Outstanding', 'Overdue', 'Risk', 'Next Action', 'Days Overdue', 'Brand'];
  const rows = data.map(c => [
    c.entity_name,
    c.entity_type,
    c.total_outstanding.toFixed(2),
    c.total_overdue.toFixed(2),
    c.risk_tier,
    c.next_action_at ? format(new Date(c.next_action_at), 'yyyy-MM-dd') : '-',
    c.days_overdue,
    c.brand || '-',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `collections-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CollectionsCalendar() {
  const { data: collections, isLoading } = useCollections();
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');

  const filtered = (collections || []).filter(c => {
    if (filter === 'today') return c.next_action_at && isToday(new Date(c.next_action_at));
    if (filter === 'week') return c.next_action_at && isThisWeek(new Date(c.next_action_at));
    if (filter === 'overdue') return c.days_overdue > 0;
    return true;
  });

  const totalOutstanding = filtered.reduce((s, c) => s + c.total_outstanding, 0);
  const totalOverdue = filtered.reduce((s, c) => s + c.total_overdue, 0);
  const criticalCount = filtered.filter(c => c.risk_tier === 'critical' || c.risk_tier === 'high').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Collections Calendar
          </h2>
          <p className="text-sm text-muted-foreground">Follow-up dates, escalation tiers, and exportable pickup lists</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!filtered.length}
          onClick={() => filtered.length && exportCollectionsCSV(filtered)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export List
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold text-orange-500">${totalOutstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Overdue</p>
            <p className="text-xl font-bold text-red-500">${totalOverdue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Active Accounts</p>
            <p className="text-xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Critical / High</p>
            <p className="text-xl font-bold text-red-500">{criticalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {(['all', 'today', 'week', 'overdue'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'today' ? 'Due Today' : f === 'week' ? 'This Week' : 'Overdue'}
          </Button>
        ))}
      </div>

      {/* Collections List */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map(collection => {
                const dateInfo = getDateLabel(collection.next_action_at);
                return (
                  <div
                    key={collection.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className={getRiskColor(collection.risk_tier)}>
                        {collection.risk_tier}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{collection.entity_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{collection.entity_type}</span>
                        {collection.brand && <span>• {collection.brand}</span>}
                        {collection.days_overdue > 0 && (
                          <span className="text-red-400">{collection.days_overdue}d overdue</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold">${collection.total_outstanding.toLocaleString()}</p>
                      <p className={`text-xs ${dateInfo.urgent ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                        {dateInfo.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm">No collections matching this filter</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
