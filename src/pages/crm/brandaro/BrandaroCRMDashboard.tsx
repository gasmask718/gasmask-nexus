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
import CRMLayout from '../CRMLayout';
import LastUserLogsTable from '@/components/crm/brandaro/LastUserLogsTable';

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
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <div className="grid gap-3">
            {filtered.map((lead: any) => (
              <Card key={lead.id} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => navigate(`/crm/brandaro/${lead.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base">{lead.business_name || 'Unnamed lead'}</h3>
                        {lead.status && (
                          <Badge variant="outline" className={STATUS_COLORS[lead.status] || ''}>
                            {lead.status}
                          </Badge>
                        )}
                        {lead.priority_tier && (
                          <Badge variant="outline">{lead.priority_tier}</Badge>
                        )}
                        {lead.has_website === false && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                            No website
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {lead.industry && <span>{lead.industry}</span>}
                        {lead.location && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.location}</span>
                        )}
                        {lead.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>
                        )}
                        {lead.website && (
                          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{lead.website}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-sky-500">{lead.intent_score ?? 0}</div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Intent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium">{lead.pipeline || 'inbound'}</div>
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Pipeline</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
