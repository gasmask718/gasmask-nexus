import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, RefreshCw, ChevronDown, Edit2, Trash2, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import { DevLeadEditor } from './DevLeadEditor';

interface FunnelConfig {
  key: string;
  label: string;
  table: string;
}

interface Props {
  funnel: FunnelConfig;
  userEmail: string;
}

const QA_BADGES: Record<string, { color: string; icon: any }> = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  passed: { color: 'text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/30', icon: CheckCircle },
  flagged: { color: 'text-red-400 bg-red-400/10 border-red-400/30', icon: XCircle },
};

export const DevLeadTable = ({ funnel, userEmail }: Props) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [qaMap, setQaMap] = useState<Record<string, any>>({});
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from(funnel.table as any).select('*').order(sortCol, { ascending: sortDir === 'asc' }).limit(200);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        const cols = Object.keys(data[0]).filter(c => !['id'].includes(c));
        setColumns(['id', ...cols.slice(0, 12)]);
      }
      setRows(data || []);

      // Fetch QA tags for these leads
      if (data && data.length > 0) {
        const ids = data.map((r: any) => r.id);
        const { data: qaTags } = await supabase
          .from('developer_qa_tags')
          .select('*')
          .eq('funnel_source', funnel.key)
          .in('lead_id', ids);
        if (qaTags) {
          const map: Record<string, any> = {};
          qaTags.forEach((t: any) => { map[t.lead_id] = t; });
          setQaMap(map);
        }
      }
    } catch (e: any) {
      toast.error(`Fetch error: ${e.message}`);
    }
    setLoading(false);
  }, [funnel.table, funnel.key, sortCol, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this record?')) return;
    const { error } = await supabase.from(funnel.table as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    await supabase.from('developer_audit_log').insert({
      action: 'DELETE', actor_email: userEmail, target_table: funnel.table, target_id: id,
    });
    toast.success('Record deleted');
    fetchData();
  };

  const setQaStatus = async (leadId: string, status: string) => {
    const existing = qaMap[leadId];
    if (existing) {
      await supabase.from('developer_qa_tags').update({
        qa_status: status, tester_email: userEmail, tested_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('developer_qa_tags').insert({
        lead_id: leadId, funnel_source: funnel.key, qa_status: status,
        tester_email: userEmail, tested_at: new Date().toISOString(),
      });
    }
    await supabase.from('developer_audit_log').insert({
      action: `QA_${status.toUpperCase()}`, actor_email: userEmail,
      target_table: funnel.table, target_id: leadId,
    });
    fetchData();
  };

  const filteredRows = search
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const truncate = (v: any, max = 24) => {
    if (v === null || v === undefined) return '—';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter records..."
            className="w-full bg-[#0d0d15] border border-[#1a1a2e] rounded pl-7 pr-3 py-1.5 text-[11px] text-[#c8c8d0] placeholder:text-[#333] focus:border-[#00ff88]/30 focus:outline-none"
          />
        </div>
        <button onClick={fetchData} className="p-1.5 bg-[#1a1a2e] rounded border border-[#2a2a3e] hover:border-[#00ff88]/30 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-[#555] ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="ml-auto text-[10px] text-[#444]">
          {filteredRows.length} / {rows.length} records | {funnel.table}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-[#1a1a2e] rounded bg-[#0b0b14]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0d0d15] z-10">
            <tr>
              <th className="px-2 py-2 text-left text-[9px] uppercase tracking-widest text-[#00ff88]/60 border-b border-[#1a1a2e] whitespace-nowrap">QA</th>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  className="px-2 py-2 text-left text-[9px] uppercase tracking-widest text-[#555] border-b border-[#1a1a2e] cursor-pointer hover:text-[#00ff88] transition-colors whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                  {sortCol === col && (
                    <ChevronDown className={`inline w-3 h-3 ml-1 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-left text-[9px] uppercase tracking-widest text-[#555] border-b border-[#1a1a2e]">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const qa = qaMap[row.id];
              const qaStatus = qa?.qa_status || 'pending';
              const badge = QA_BADGES[qaStatus] || QA_BADGES.pending;
              const BadgeIcon = badge.icon;
              return (
                <tr
                  key={row.id || i}
                  className="border-b border-[#111] hover:bg-[#1a1a2e]/30 transition-colors group"
                >
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      {Object.entries(QA_BADGES).map(([status, b]) => {
                        const Icon = b.icon;
                        return (
                          <button
                            key={status}
                            onClick={() => setQaStatus(row.id, status)}
                            className={`p-0.5 rounded transition-all ${
                              qaStatus === status ? b.color + ' border' : 'text-[#333] hover:text-[#666]'
                            }`}
                            title={status}
                          >
                            <Icon className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  {columns.map(col => (
                    <td key={col} className="px-2 py-1.5 text-[#888] whitespace-nowrap max-w-[160px] overflow-hidden text-ellipsis">
                      {truncate(row[col])}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingRow(row)} className="p-1 hover:text-[#00ff88] text-[#555] transition-colors">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(row.id)} className="p-1 hover:text-red-400 text-[#555] transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-12 text-[#333] text-xs">
                  {loading ? 'Loading...' : 'No records found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Panel */}
      {editingRow && (
        <DevLeadEditor
          row={editingRow}
          table={funnel.table}
          userEmail={userEmail}
          onClose={() => setEditingRow(null)}
          onSaved={() => { setEditingRow(null); fetchData(); }}
        />
      )}
    </div>
  );
};
