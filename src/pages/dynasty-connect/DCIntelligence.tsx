import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';

const BIZ_OPTIONS = [
  { value: '', label: 'All Businesses' }, { value: 'gasmask', label: 'GasMask' },
  { value: 'unforgettable_times', label: 'Unforgettable Times' }, { value: 'real_estate', label: 'Real Estate' },
  { value: 'surplus_funds', label: 'Surplus Funds' }, { value: 'top_tier', label: 'Top Tier' },
  { value: 'brandaro', label: 'Brandaro' }, { value: 'playboxxx', label: 'PlayBoxxx' }, { value: 'iclean', label: 'iClean' },
];

export default function DCIntelligence() {
  const [bizFilter, setBizFilter] = useState('');
  const [dirFilter, setDirFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['dc-call-logs', bizFilter, dirFilter, statusFilter, page],
    queryFn: async () => {
      let q = (supabase as any).from('dc_call_logs').select('*').order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (bizFilter) q = q.eq('business', bizFilter);
      if (dirFilter) q = q.eq('direction', dirFilter);
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: stats = { total: 0, connected: 0, voicemail: 0, avgDur: 0, totalMin: 0 } } = useQuery({
    queryKey: ['dc-call-log-stats'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_call_logs').select('status, duration_seconds');
      if (!data) return { total: 0, connected: 0, voicemail: 0, avgDur: 0, totalMin: 0 };
      const total = data.length;
      const connected = data.filter((c: any) => ['connected', 'completed'].includes(c.status)).length;
      const voicemail = data.filter((c: any) => c.status === 'voicemail').length;
      const totalSec = data.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0);
      return { total, connected, voicemail, avgDur: total > 0 ? Math.round(totalSec / total) : 0, totalMin: Math.round(totalSec / 60) };
    },
  });

  const exportCSV = () => {
    const headers = ['Date', 'Business', 'Agent', 'Lead', 'From', 'To', 'Direction', 'Status', 'Duration', 'Outcome'];
    const rows = calls.map((c: any) => [new Date(c.created_at).toLocaleString(), c.business || '', c.agent_name || c.agent_id || '', c.lead_name || '', c.from_number || '', c.to_number || '', c.direction || '', c.status || '', c.duration_seconds || 0, c.outcome || '']);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dc-call-logs-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">📋 Call History</h1><p className="text-sm text-muted-foreground">Complete log of all AI agent calls</p></div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ l: 'Total', v: stats.total }, { l: 'Connected', v: stats.connected }, { l: 'Voicemails', v: stats.voicemail }, { l: 'Avg Duration', v: `${stats.avgDur}s` }, { l: 'Total Min', v: stats.totalMin }].map((s) => (
          <Card key={s.l}><CardContent className="pt-3 pb-2 text-center"><div className="text-xl font-bold">{s.v}</div><p className="text-xs text-muted-foreground">{s.l}</p></CardContent></Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={bizFilter} onValueChange={setBizFilter}><SelectTrigger className="w-44"><SelectValue placeholder="All Businesses" /></SelectTrigger><SelectContent>{BIZ_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent></Select>
        <Select value={dirFilter} onValueChange={setDirFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Direction" /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem value="inbound">Inbound</SelectItem><SelectItem value="outbound">Outbound</SelectItem></SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem value="connected">Connected</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="voicemail">Voicemail</SelectItem><SelectItem value="initiated">Initiated</SelectItem></SelectContent></Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Date</th><th className="p-3">Business</th><th className="p-3">Agent</th><th className="p-3">Lead</th><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Dir</th><th className="p-3">Status</th><th className="p-3">Duration</th></tr></thead>
              <tbody>
                {calls.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="p-3">{c.business || '-'}</td>
                    <td className="p-3 text-xs">{c.agent_name || c.agent_id?.slice(-8) || '-'}</td>
                    <td className="p-3">{c.lead_name || '-'}</td>
                    <td className="p-3 font-mono text-xs">{c.from_number || '-'}</td>
                    <td className="p-3 font-mono text-xs">{c.to_number || '-'}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{c.direction}</Badge></td>
                    <td className="p-3"><Badge variant="outline" className={`text-xs ${['connected', 'completed'].includes(c.status) ? 'bg-green-500/10 text-green-500 border-green-500' : c.status === 'voicemail' ? 'bg-amber-500/10 text-amber-500 border-amber-500' : ''}`}>{c.status}</Badge></td>
                    <td className="p-3">{c.duration_seconds > 0 ? `${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, '0')}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isLoading && <p className="text-center py-4 text-muted-foreground">Loading...</p>}
          {!isLoading && calls.length === 0 && <p className="text-center py-4 text-muted-foreground">No calls found</p>}
        </CardContent>
      </Card>
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground self-center">Page {page + 1}</span>
        <Button variant="outline" size="sm" disabled={calls.length < pageSize} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
