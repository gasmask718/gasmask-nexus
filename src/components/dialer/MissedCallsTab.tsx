import { useState, useMemo } from 'react';
import { useMissedCalls } from '@/hooks/useMissedCalls';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, PhoneOff, Voicemail, MessageSquare, RefreshCw } from 'lucide-react';

export default function MissedCallsTab() {
  const { data: missedCalls, isLoading, refetch } = useMissedCalls();
  const [filter, setFilter] = useState<'all' | 'no_answer' | 'voicemail' | 'hung_up'>('all');

  const filtered = useMemo(() =>
    (missedCalls || []).filter((c: any) =>
      filter === 'all' || c.outcome === filter
    ), [missedCalls, filter]);

  const filterCounts = useMemo(() => {
    const calls = missedCalls || [];
    return {
      all: calls.length,
      no_answer: calls.filter((c: any) => c.outcome === 'no_answer' || c.outcome === 'missed').length,
      voicemail: calls.filter((c: any) => c.outcome === 'voicemail').length,
      hung_up: calls.filter((c: any) => c.outcome === 'hung_up').length,
    };
  }, [missedCalls]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Missed Calls</h3>
          <p className="text-sm text-muted-foreground">
            {missedCalls?.length || 0} missed calls from outreach history
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'no_answer', 'voicemail', 'hung_up'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'no_answer' ? 'No Answer' : f === 'voicemail' ? 'Voicemail' : 'Hung Up'}
            <Badge variant="secondary" className="text-[10px] ml-1">{filterCounts[f]}</Badge>
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[500px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !filtered.length ? (
          <div className="text-center py-16">
            <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground font-medium">No missed calls found.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Missed calls are logged when outreach calls result in no answer, voicemail, or hang up.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((call: any) => {
              const lead = call.outreach_leads;
              return (
                <Card key={call.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      {call.outcome === 'voicemail'
                        ? <Voicemail className="h-4 w-4 text-amber-600" />
                        : <PhoneOff className="h-4 w-4 text-destructive" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {lead?.store_name || lead?.contact_name || call.phone || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(call.call_date || call.created_at).toLocaleString()}</span>
                        {lead?.phone && <span className="font-mono">{lead.phone}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {call.outcome || 'no answer'}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0">
                      <Phone className="h-3 w-3" /> Call Back
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs shrink-0">
                      <MessageSquare className="h-3 w-3" /> Text
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
