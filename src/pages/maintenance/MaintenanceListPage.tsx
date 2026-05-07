/**
 * MaintenanceListPage — master daily dashboard for PMs / VAs.
 * Filterable feed of: monthly deliverables, change requests, billing alerts, AI upsells.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, CheckCircle2, ExternalLink, Wrench } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  monthly_deliverable: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  change_request: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  billing_alert: 'bg-red-500/10 text-red-600 border-red-500/30',
  ai_upsell: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  manual: 'bg-zinc-500/10 text-zinc-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-red-500/40 text-red-600',
  high: 'border-amber-500/40 text-amber-600',
  normal: '',
  low: 'opacity-70',
};

export default function MaintenanceListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open_only');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['brandaro-maintenance-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_maintenance_tasks')
        .select('*, lead:brandaro_leads_master(id, business_name)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (statusFilter === 'open_only' && (r.status === 'done' || r.status === 'dismissed')) return false;
      if (statusFilter !== 'open_only' && statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.task_type !== typeFilter) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.title?.toLowerCase().includes(q) &&
          !r.description?.toLowerCase().includes(q) &&
          !r.lead?.business_name?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, typeFilter, priorityFilter]);

  const counts = useMemo(() => {
    const open = rows.filter((r: any) => r.status !== 'done' && r.status !== 'dismissed');
    return {
      total: open.length,
      urgent: open.filter((r: any) => r.priority === 'urgent').length,
      billing: open.filter((r: any) => r.task_type === 'billing_alert').length,
      upsells: open.filter((r: any) => r.task_type === 'ai_upsell').length,
    };
  }, [rows]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('brandaro_maintenance_tasks')
        .update({ status, completed_at: status === 'done' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brandaro-maintenance-list'] }),
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7" /> Maintenance List
          </h1>
          <p className="text-muted-foreground mt-1">
            Daily action board for Project Managers & VA Customer Service.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Open Tasks" value={counts.total} />
          <Stat label="Urgent" value={counts.urgent} accent="text-red-600" />
          <Stat label="Billing Alerts" value={counts.billing} accent="text-red-600" />
          <Stat label="AI Upsell Hints" value={counts.upsells} accent="text-amber-600" />
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search tasks or clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open_only">Open only</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="monthly_deliverable">Monthly deliverable</SelectItem>
                <SelectItem value="change_request">Change request</SelectItem>
                <SelectItem value="billing_alert">Billing alert</SelectItem>
                <SelectItem value="ai_upsell">AI upsell</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No tasks match your filters.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Task</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Due</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                      <td className="p-3">
                        <div className="font-medium">{r.title}</div>
                        {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
                        {r.ai_generated && <Badge variant="secondary" className="text-[10px] mt-1">AI</Badge>}
                      </td>
                      <td className="p-3">
                        {r.lead ? (
                          <button className="text-sm hover:underline flex items-center gap-1" onClick={() => navigate(`/crm/brandaro/${r.lead.id}`)}>
                            {r.lead.business_name} <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3"><Badge variant="outline" className={TYPE_COLORS[r.task_type]}>{r.task_type.replace('_', ' ')}</Badge></td>
                      <td className="p-3"><Badge variant="outline" className={PRIORITY_COLORS[r.priority]}>{r.priority}</Badge></td>
                      <td className="p-3 text-muted-foreground">{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</td>
                      <td className="p-3">
                        <Select value={r.status} onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v })}>
                          <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="dismissed">Dismissed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {r.status !== 'done' && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: 'done' })}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />Complete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
        <div className={`text-2xl font-bold ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
