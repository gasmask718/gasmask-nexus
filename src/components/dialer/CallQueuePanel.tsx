import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Search, Play, Square, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CallQueuePanelProps {
  bizId: string | undefined;
  isRunning: boolean;
  onStartSession: (leads: any[]) => void;
  onStopSession: () => void;
}

const langFlags: Record<string, string> = {
  arabic: '🇸🇦',
  spanish: '🇪🇸',
  english: '🇺🇸',
};

export function CallQueuePanel({ bizId, isRunning, onStartSession, onStopSession }: CallQueuePanelProps) {
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['call-queue-leads', bizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('id, store_name, contact_name, phone, language_detected, lead_score, status, phone_type, sms_capable')
        .in('status', ['new', 'queued'])
        .not('phone', 'is', null)
        .order('lead_score', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bizId,
    refetchInterval: 10000,
  });

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.store_name || '').toLowerCase().includes(q)
      || (l.contact_name || '').toLowerCase().includes(q)
      || (l.phone || '').includes(q);
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> Call Queue
            <Badge variant="secondary" className="text-[10px]">{leads.length}</Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 pt-0 gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="h-8 text-xs pl-7"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {leads.length === 0 ? 'No leads in queue' : 'No matches'}
              </p>
            ) : (
              filtered.map(lead => (
                <div key={lead.id} className="p-2 border rounded-lg text-xs hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium truncate">{lead.store_name || lead.contact_name || 'Unknown'}</span>
                    {lead.lead_score != null && (
                      <Badge variant="outline" className={`text-[10px] ${
                        lead.lead_score >= 70 ? 'text-green-600 border-green-500/30' :
                        lead.lead_score >= 40 ? 'text-amber-600 border-amber-500/30' :
                        'text-muted-foreground'
                      }`}>
                        {lead.lead_score}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-mono">{lead.phone}</span>
                    {lead.language_detected && (
                      <span>{langFlags[lead.language_detected] || '🌐'}</span>
                    )}
                    {lead.phone_type === 'landline' && (
                      <span className="text-amber-500" title="Landline — no SMS">
                        <AlertTriangle className="h-3 w-3 inline" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-1 border-t">
          {isRunning ? (
            <Button size="sm" variant="destructive" className="flex-1 gap-1.5 text-xs" onClick={onStopSession}>
              <Square className="h-3 w-3" /> Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => onStartSession(filtered)}
              disabled={filtered.length === 0}
            >
              <Play className="h-3 w-3" /> Start ({filtered.length})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
