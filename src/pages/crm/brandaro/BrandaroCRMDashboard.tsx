/**
 * BrandaroCRMDashboard — Brandaro business CRM inside the global /crm hub.
 * Surfaces all brandaro_leads_master records linked to the Brandaro business.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Search, Loader2, Sparkles,
  Users, Target, Flame, TrendingUp,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import CRMLayout from '../CRMLayout';
import LastUserLogsTable from '@/components/crm/brandaro/LastUserLogsTable';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  contacted: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  qualified: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  proposal: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  won: 'bg-green-500/10 text-green-600 border-green-500/30',
  lost: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export default function BrandaroCRMDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: business } = useQuery({
    queryKey: ['business-brandaro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug, primary_color, tagline')
        .eq('slug', 'brandaro')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['brandaro-leads', business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_leads_master')
        .select('*')
        .eq('business_id', business!.id)
        .order('intent_score', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return leads.filter((l: any) => {
      const matchesSearch = !search ||
        l.business_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.email?.toLowerCase().includes(search.toLowerCase()) ||
        l.phone?.includes(search) ||
        l.location?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const kpis = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter((l: any) => (l.intent_score || 0) >= 70).length;
    const qualified = leads.filter((l: any) => l.status === 'qualified' || l.status === 'won').length;
    const withWebsite = leads.filter((l: any) => l.has_website).length;
    return { total, hot, qualified, withWebsite };
  }, [leads]);

  const statuses = useMemo(
    () => Array.from(new Set(leads.map((l: any) => l.status).filter(Boolean))) as string[],
    [leads]
  );

  return (
    <CRMLayout title="Brandaro CRM">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6" style={{ color: business?.primary_color || '#0EA5E9' }} />
              <h1 className="text-2xl font-bold">Brandaro CRM</h1>
              <Badge variant="outline" className="border-sky-500/30 text-sky-600">Live</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {business?.tagline || 'AI-Powered Brand Domination'} — All Brandaro leads in one place.
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Leads" value={kpis.total} icon={Users} color="text-sky-500" />
          <KpiCard label="Hot (Intent ≥70)" value={kpis.hot} icon={Flame} color="text-orange-500" />
          <KpiCard label="Qualified / Won" value={kpis.qualified} icon={Target} color="text-emerald-500" />
          <KpiCard label="Has Website" value={kpis.withWebsite} icon={TrendingUp} color="text-amber-500" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by business, email, phone, location..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No Brandaro leads match your filters.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Business Name</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead className="text-right">Intent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((lead: any) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/crm/brandaro/${lead.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{lead.business_name || 'Unnamed lead'}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.priority_tier && (
                              <Badge variant="outline" className="text-[10px]">{lead.priority_tier}</Badge>
                            )}
                            {lead.has_website === false && (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                                No website
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.industry || '—'}</TableCell>
                        <TableCell className="text-sm">{lead.location || '—'}</TableCell>
                        <TableCell className="text-sm font-mono">{lead.phone || '—'}</TableCell>
                        <TableCell className="text-sm">{lead.email || '—'}</TableCell>
                        <TableCell className="text-sm max-w-[180px] truncate">
                          {lead.website ? (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.website}
                            </a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {lead.status ? (
                            <Badge variant="outline" className={STATUS_COLORS[lead.status] || ''}>
                              {lead.status}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{lead.pipeline || 'inbound'}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-base font-bold text-sky-500">{lead.intent_score ?? 0}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <LastUserLogsTable />
      </div>
    </CRMLayout>
  );
}

function KpiCard({
  label, value, icon: Icon, color,
}: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
