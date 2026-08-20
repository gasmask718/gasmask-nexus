import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, ChevronLeft, Download, Volume2 } from 'lucide-react';

const BU_LABEL: Record<string, string> = {
  top_tier: 'TopTier',
  unforgettable_times: 'Unforgettable Times',
  surplus_funds: 'Surplus Funds',
  real_estate: 'Real Estate',
  dynasty_direct: 'Dynasty Direct',
  gasmask: 'GasMask',
  brandaro: 'Brandaro',
};
const BU_BADGE: Record<string, string> = {
  top_tier: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  unforgettable_times: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  surplus_funds: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  real_estate: 'bg-green-500/15 text-green-400 border-green-500/40',
  dynasty_direct: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  gasmask: 'bg-red-500/15 text-red-400 border-red-500/40',
  brandaro: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
};

const PAGE_SIZE = 25;

function formatDur(s: number | null | undefined): string {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// dc_call_logs.business is the source of truth for business unit.
// Value stored is the same business_unit_key set as in dc_unified_leads
// (dynasty_direct, top_tier, etc). Normalize gracefully otherwise.
function normalizeBU(v: string | null | undefined): string {
  if (!v) return 'unknown';
  return v.toLowerCase().replace(/-/g, '_');
}

export default function DCRecordingsPage() {
  const [bu, setBu] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dc-recordings', bu, dateFrom, dateTo, page],
    queryFn: async () => {
      let q = (supabase as any)
        .from('dc_call_logs')
        .select('*', { count: 'exact' })
        .not('recording_url', 'is', null)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (bu !== 'all') q = q.eq('business', bu);
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', dateTo);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data || []) as any[], count: count || 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Volume2 className="h-6 w-6" /> Recordings
        </h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} call recordings — click a row to play
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={bu} onValueChange={(v) => { setBu(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Business unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {Object.entries(BU_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            />
            <div className="text-xs text-muted-foreground flex items-center">
              Showing recordings only (recording_url IS NOT NULL)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Lead</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">When</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading recordings…</td></tr>
                )}
                {error && !isLoading && (
                  <tr><td colSpan={7} className="p-8 text-center text-red-500">Error: {(error as Error).message}</td></tr>
                )}
                {!isLoading && !error && rows.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No recordings match these filters</td></tr>
                )}
                {rows.map((r) => {
                  const key = normalizeBU(r.business);
                  const isOpen = expanded === r.id;
                  return (
                    <>
                      <tr
                        key={r.id}
                        className="border-b border-border/50 hover:bg-accent/50 cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <td className="p-3">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="p-3 font-medium">{r.lead_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={BU_BADGE[key] || ''}>
                            {BU_LABEL[key] || r.business || 'unknown'}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs">{r.to_number || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-3">{formatDur(r.duration_seconds)}</td>
                        <td className="p-3 text-xs">{r.outcome || r.status || <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${r.id}-player`} className="border-b border-border/50 bg-muted/20">
                          <td colSpan={7} className="p-4">
                            <div className={`grid gap-4 ${r.transcript ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                              {/* Player */}
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Playback</div>
                                <RecordingPlayer
                                  recordingUrl={r.recording_url}
                                  recordingSid={r.call_sid || r.id}
                                />
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Duration: {formatDur(r.duration_seconds)}</span>
                                  <span>•</span>
                                  <span>Agent: {r.agent_name || r.agent_id || '—'}</span>
                                </div>

                              </div>

                              {/* Transcript */}
                              {r.transcript && (
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground">Transcript</div>
                                  <div className="max-h-64 overflow-y-auto text-xs whitespace-pre-wrap bg-background/50 p-3 rounded border border-border/50">
                                    {r.transcript}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {total === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              ><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs">Page {page + 1} / {totalPages}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              ><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
