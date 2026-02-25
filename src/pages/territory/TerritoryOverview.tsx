import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Eye, Store, HelpCircle, XCircle, Target, ListFilter, Map, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { TerritoryStoresTable } from '@/components/territory/TerritoryStoresTable';
import { TerritoryMapView } from '@/components/territory/TerritoryMapView';

export default function TerritoryOverview() {
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [generating, setGenerating] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['territory-address-status-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_territory_address_status_summary')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Get unique cities and states for filters
  const cities = [...new Set((summary || []).map((r: any) => r.city).filter(Boolean))].sort();
  const states = [...new Set((summary || []).map((r: any) => r.state).filter(Boolean))].sort();

  // Apply filters
  const filtered = (summary || []).filter((row: any) => {
    if (cityFilter !== 'all' && row.city !== cityFilter) return false;
    if (stateFilter !== 'all' && row.state !== stateFilter) return false;
    return true;
  });

  const totals = filtered.reduce(
    (acc: any, row: any) => ({
      total: acc.total + (row.total_addresses || 0),
      unknown: acc.unknown + (row.unknown_addresses || 0),
      scouted: acc.scouted + (row.scouted_addresses || 0),
      verified: acc.verified + (row.verified_stores || 0),
      candidates: acc.candidates + (row.candidates || 0),
      wholesalers: acc.wholesalers + (row.wholesalers || 0),
      deadEnds: acc.deadEnds + (row.dead_ends || 0),
    }),
    { total: 0, unknown: 0, scouted: 0, verified: 0, candidates: 0, wholesalers: 0, deadEnds: 0 }
  );

  const coveragePct = totals.total > 0
    ? Math.round(((totals.total - totals.unknown) / totals.total) * 100)
    : 0;

  const kpis = [
    { label: 'Total Addresses', value: totals.total, icon: MapPin, color: 'text-primary' },
    { label: 'Coverage', value: `${coveragePct}%`, icon: Target, color: 'text-emerald-500' },
    { label: 'Verified Stores', value: totals.verified, icon: Store, color: 'text-green-500' },
    { label: 'Candidates', value: totals.candidates, icon: Eye, color: 'text-amber-500' },
    { label: 'Unknown', value: totals.unknown, icon: HelpCircle, color: 'text-muted-foreground' },
    { label: 'Dead Ends', value: totals.deadEnds, icon: XCircle, color: 'text-destructive' },
  ];

  const handleGenerateTasks = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_territory_tasks');
      if (error) throw error;
      toast.success(`Generated ${(data as any)?.tasks_created ?? 0} tasks from territory intelligence`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate tasks');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Territory Control Center</h1>
          <p className="text-muted-foreground text-sm">Read-only awareness of all territory intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <ListFilter className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleGenerateTasks} disabled={generating} variant="outline">
            <ClipboardList className="h-4 w-4 mr-2" />
            {generating ? 'Generating…' : 'Generate Tasks'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {(cityFilter !== 'all' || stateFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setCityFilter('all'); setStateFilter('all'); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {viewMode === 'map' ? (
            <TerritoryMapView />
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                        <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* City/State Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Address Status by City</CardTitle>
                </CardHeader>
                <CardContent>
                  {filtered.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 px-3">City</th>
                            <th className="text-left py-2 px-3">State</th>
                            <th className="text-right py-2 px-3">Total</th>
                            <th className="text-right py-2 px-3">Unknown</th>
                            <th className="text-right py-2 px-3">Scouted</th>
                            <th className="text-right py-2 px-3">Verified</th>
                            <th className="text-right py-2 px-3">Candidates</th>
                            <th className="text-right py-2 px-3">Dead Ends</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-2 px-3 font-medium">{row.city || '—'}</td>
                              <td className="py-2 px-3">{row.state || '—'}</td>
                              <td className="py-2 px-3 text-right">{row.total_addresses}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{row.unknown_addresses}</td>
                              <td className="py-2 px-3 text-right">{row.scouted_addresses}</td>
                              <td className="py-2 px-3 text-right text-green-500">{row.verified_stores}</td>
                              <td className="py-2 px-3 text-right text-amber-500">{row.candidates}</td>
                              <td className="py-2 px-3 text-right text-destructive">{row.dead_ends}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No territory data yet. Import addresses to begin.</p>
                  )}
                </CardContent>
              </Card>

              {/* Stores in Territory */}
              <TerritoryStoresTable cityFilter={cityFilter} stateFilter={stateFilter} />
            </>
          )}
        </>
      )}
    </div>
  );
}
