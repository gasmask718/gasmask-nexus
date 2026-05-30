import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Search, Phone, Clock, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { format } from 'date-fns';

export default function DialerHistoryPage() {
  const { currentBusiness } = useBusiness();
  const [filters, setFilters] = useState({ outcome: 'all', search: '', dateFrom: '', dateTo: '' });
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ['dialer-history', currentBusiness?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('dialer_call_attempts')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('started_at', { ascending: false })
        .limit(200);

      if (filters.outcome !== 'all') {
        query = query.eq('attempt_state', filters.outcome as any);
      }
      if (filters.dateFrom) {
        query = query.gte('started_at', new Date(filters.dateFrom).toISOString());
      }
      if (filters.dateTo) {
        query = query.lte('started_at', new Date(filters.dateTo + 'T23:59:59').toISOString());
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  const filteredAttempts = filters.search
    ? attempts.filter(a =>
        a.target_phone_e164?.includes(filters.search) ||
        a.outcome_code?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : attempts;

  const exportCSV = () => {
    const headers = ['Date', 'Phone', 'State', 'AMD', 'Duration', 'Agent', 'Conference', 'Blocked Reason'];
    const rows = filteredAttempts.map(a => [
      a.started_at ? format(new Date(a.started_at), 'yyyy-MM-dd HH:mm') : '',
      a.target_phone_e164 || '',
      a.attempt_state || '',
      a.amd_result || '',
      a.duration_seconds?.toString() || '',
      a.agent_user_id || '',
      a.conference_name || '',
      a.blocked_reason || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dialer-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stateColor = (state: string) => {
    const map: Record<string, string> = {
      bridged: 'bg-blue-500/10 text-blue-600',
      completed: 'bg-green-500/10 text-green-600',
      answered_human: 'bg-green-500/10 text-green-600',
      answered_machine: 'bg-purple-500/10 text-purple-600',
      failed: 'bg-destructive/10 text-destructive',
      blocked: 'bg-orange-500/10 text-orange-600',
      agent_missed: 'bg-amber-500/10 text-amber-600',
    };
    return map[state] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="w-full min-h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Call History Ledger
        </h2>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search phone..."
                className="w-48"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select value={filters.outcome} onValueChange={v => setFilters(f => ({ ...f, outcome: v }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="bridged">Bridged</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="answered_human">Human Answer</SelectItem>
                <SelectItem value="answered_machine">Machine</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="agent_missed">Agent Missed</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-40" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
            <span className="text-muted-foreground self-center">to</span>
            <Input type="date" className="w-40" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>AMD</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Conference</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isLoading ? 'Loading...' : 'No attempts found'}
                    </TableCell>
                  </TableRow>
                ) : filteredAttempts.map(attempt => (
                  <TableRow key={attempt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAttempt(attempt)}>
                    <TableCell className="text-xs">
                      {attempt.started_at ? format(new Date(attempt.started_at), 'MMM d, yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{attempt.target_phone_e164}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${stateColor(attempt.attempt_state)}`}>
                        {attempt.attempt_state?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{attempt.amd_result || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {attempt.duration_seconds ? `${Math.floor(attempt.duration_seconds / 60)}m ${attempt.duration_seconds % 60}s` : '-'}
                    </TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-[120px]">{attempt.conference_name || '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Details</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedAttempt} onOpenChange={(o) => { if (!o) setSelectedAttempt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attempt Detail</DialogTitle>
          </DialogHeader>
          {selectedAttempt && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{selectedAttempt.target_phone_e164}</span></div>
                <div><span className="text-muted-foreground">State:</span> <Badge variant="outline" className={`text-xs ${stateColor(selectedAttempt.attempt_state)}`}>{selectedAttempt.attempt_state}</Badge></div>
                <div><span className="text-muted-foreground">AMD:</span> {selectedAttempt.amd_result || 'N/A'}</div>
                <div><span className="text-muted-foreground">Duration:</span> {selectedAttempt.duration_seconds ? `${selectedAttempt.duration_seconds}s` : 'N/A'}</div>
                <div><span className="text-muted-foreground">Started:</span> {selectedAttempt.started_at ? format(new Date(selectedAttempt.started_at), 'PPpp') : '-'}</div>
                <div><span className="text-muted-foreground">Ended:</span> {selectedAttempt.ended_at ? format(new Date(selectedAttempt.ended_at), 'PPpp') : '-'}</div>
                <div><span className="text-muted-foreground">Conference:</span> {selectedAttempt.conference_name || 'N/A'}</div>
                <div><span className="text-muted-foreground">Whisper:</span> {selectedAttempt.whisper_played ? '✅' : '❌'}</div>
              </div>
              {selectedAttempt.blocked_reason && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2 text-orange-600">
                  Blocked: {selectedAttempt.blocked_reason}
                </div>
              )}
              {selectedAttempt.recording_url && (
                <div>
                  <p className="text-muted-foreground mb-1">Recording:</p>
                  <audio controls src={selectedAttempt.recording_url} className="w-full" />
                </div>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Target SID: {selectedAttempt.target_call_sid || 'N/A'}</p>
                <p>Agent SID: {selectedAttempt.agent_call_sid || 'N/A'}</p>
                <p>Queue Item: {selectedAttempt.queue_item_id || 'N/A'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
