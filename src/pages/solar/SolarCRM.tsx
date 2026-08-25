import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Home, Search, ArrowUpDown, ShieldAlert } from 'lucide-react';

const AMBER = '#E8A317';

const CRM_STAGES = ['identified', 'contacted', 'interested', 'onboarded', 'active', 'declined'] as const;

type SortKey = 'company_name' | 'crm_stage' | 'licence_state' | 'last_contacted_at';

function licenceBadge(status: string | null) {
  const s = (status || 'unknown').toLowerCase();
  if (s.includes('active') || s.includes('valid')) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (s.includes('expire') || s.includes('lapsed') || s.includes('suspend')) return 'bg-destructive/15 text-destructive border-destructive/30';
  if (s.includes('pending')) return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

export default function SolarCRM() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('company_name');
  const [sortAsc, setSortAsc] = useState(true);

  const { data: installers = [], isLoading, error } = useQuery({
    queryKey: ['bs-installers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bs_installers')
        .select('*')
        .order('company_name', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: homeowners = [], error: homeownerError } = useQuery({
    queryKey: ['bs-homeowner-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bs_crm_homeowner_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, crm_stage }: { id: string; crm_stage: string }) => {
      const { error } = await supabase.from('bs_installers').update({ crm_stage }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bs-installers'] });
      toast.success('Stage updated');
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = installers.filter((i: any) => {
      const matchesStage = stageFilter === 'all' || i.crm_stage === stageFilter;
      const matchesSearch =
        !q ||
        [i.company_name, i.phone, i.licence_state, i.roc_licence_number, i.next_action]
          .filter(Boolean)
          .some((v: string) => String(v).toLowerCase().includes(q));
      return matchesStage && matchesSearch;
    });
    list = [...list].sort((a: any, b: any) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [installers, search, stageFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: AMBER }}>Solar CRM</h1>
        <p className="text-sm text-muted-foreground">Floor 1 — installer network and homeowner pipeline</p>
      </div>

      <Tabs defaultValue="installers">
        <TabsList>
          <TabsTrigger value="installers" className="gap-2"><Users className="h-4 w-4" /> Installers</TabsTrigger>
          <TabsTrigger value="homeowners" className="gap-2"><Home className="h-4 w-4" /> Homeowners</TabsTrigger>
        </TabsList>

        <TabsContent value="installers" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search company, phone, licence, next action…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {CRM_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline">{rows.length} installers</Badge>
          </div>

          {error && (
            <Card className="border-destructive/40">
              <CardContent className="p-4 text-sm text-destructive">{(error as any).message}</CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('company_name')}>
                      <span className="inline-flex items-center gap-1">Company <ArrowUpDown className="h-3 w-3" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('crm_stage')}>Stage</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort('licence_state')}>State</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Next action</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No installers yet. Load the vetted installer list to populate this tab.
                    </TableCell></TableRow>
                  )}
                  {rows.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.company_name}</TableCell>
                      <TableCell>
                        <Select
                          value={i.crm_stage}
                          onValueChange={(v) => updateStage.mutate({ id: i.id, crm_stage: v })}
                        >
                          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CRM_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={licenceBadge(i.licence_status)}>
                          {i.licence_status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{i.licence_state || '—'}</TableCell>
                      <TableCell>{i.phone || '—'}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{i.next_action || '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{i.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homeowners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Homeowner intake is gated
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                No homeowner leads are loaded, and none should be until the state gates clear. Every jurisdiction in
                <span className="text-foreground"> bs_geo_policy</span> currently has outbound calling switched off with no
                cleared gate, and consent artifacts (TrustedForm/Jornaya token, form snapshot, IP, exact disclosure text)
                must be captured at intake before a single record can be dialled.
              </p>
              <p>
                When a jurisdiction's blocking gate is cleared and consent capture is live, homeowner leads land here with
                their consent record attached.
              </p>
              {homeownerError && <p className="text-destructive">{(homeownerError as any).message}</p>}
              <Badge variant="outline">{homeowners.length} leads</Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
