import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, Upload, Truck, BarChart3, Users, MessageSquare, Brain, Route as RouteIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';

import { CANONICAL_BRANDS } from '@/config/brands';

const brandColors = {
  GasMask: { primary: CANONICAL_BRANDS.gasmask.primaryColor, secondary: '#000000', name: CANONICAL_BRANDS.gasmask.displayName },
  HotMama: { primary: CANONICAL_BRANDS.hotmama.primaryColor, secondary: '#000000', name: CANONICAL_BRANDS.hotmama.displayName },
  GrabbaRUs: { primary: CANONICAL_BRANDS.grabba_r_us.primaryColor, secondary: '#7B68EE', name: CANONICAL_BRANDS.grabba_r_us.displayName },
  HotScalati: { primary: CANONICAL_BRANDS.hotscolatti.primaryColor, secondary: '#5A3A2E', name: CANONICAL_BRANDS.hotscolatti.displayName },
};

export default function GrabbaClusterDashboard() {
  const navigate = useNavigate();
  const [dispatchBrand, setDispatchBrand] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[]>([]);

  const { data: brandStores } = useQuery({
    queryKey: ['grabba-cluster-stores', dispatchBrand],
    queryFn: async () => {
      let q = supabase
        .from('store_brand_accounts')
        .select('store_master_id, brand, active_status, last_order_date, store_master:store_master_id(id, store_name, address, city, state)')
        .order('last_order_date', { ascending: false, nullsFirst: false })
        .limit(200);
      if (dispatchBrand !== 'all') q = q.eq('brand', dispatchBrand as any);
      const { data, error } = await q;
      if (error) throw error;
      // Dedupe by store_master_id
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const r of (data || []) as any[]) {
        if (!r.store_master_id || seen.has(r.store_master_id)) continue;
        if (!r.store_master?.id) continue;
        seen.add(r.store_master_id);
        rows.push({
          id: r.store_master.id,
          name: r.store_master.store_name || 'Unnamed',
          city: r.store_master.city,
          state: r.store_master.state,
          brand: r.brand,
          last_order_date: r.last_order_date,
        });
      }
      return rows;
    },
  });

  const visibleStoreIds = useMemo(() => (brandStores || []).map((s: any) => s.id), [brandStores]);
  const allSelected = visibleStoreIds.length > 0 && visibleStoreIds.every((id) => selectedIds.includes(id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : visibleStoreIds);

  const { data: stats } = useQuery({
    queryKey: ['grabba-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const [storesRes, accountsRes, routesRes] = await Promise.all([
        supabase.from('store_master').select('id', { count: 'exact' }).is('deleted_at', null),
        supabase.from('store_brand_accounts').select('id, brand', { count: 'exact' }),
        // CANONICAL: routes filtered by source='grabba_biker' (was legacy biker_routes)
        supabase.from('routes').select('id').eq('source', 'grabba_biker').eq('date', today)
      ]);

      const brandCounts = accountsRes.data?.reduce((acc: any, account) => {
        acc[account.brand] = (acc[account.brand] || 0) + 1;
        return acc;
      }, {});

      return {
        totalStores: storesRes.count || 0,
        totalAccounts: accountsRes.count || 0,
        activeRoutes: routesRes.data?.length || 0,
        brandCounts: brandCounts || {}
      };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Grabba Cluster Operations</h1>
        <p className="text-muted-foreground mt-2">
          Unified multi-brand management system for GasMask • HotMama • Grabba R Us • Hotscolatti
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Stores</span>
            </div>
            <div className="text-3xl font-bold">{stats?.totalStores || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Total locations</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Brand Accounts</span>
            </div>
            <div className="text-3xl font-bold">{stats?.totalAccounts || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Across 4 brands</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Routes</span>
            </div>
            <div className="text-3xl font-bold">{stats?.activeRoutes || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Today</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <div className="text-3xl font-bold">$45.2K</div>
            <div className="text-sm text-green-600 mt-1">This month</div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(brandColors).map(([brand, config]) => (
              <Button
                key={brand}
                variant="outline"
                className="p-6 h-auto flex-col items-start gap-3 hover:shadow-lg transition-shadow"
                style={{ borderTop: `4px solid ${config.primary}` }}
                onClick={() => navigate(`/grabba/brand/${brand.toLowerCase()}`)}
              >
                <div className="flex items-center justify-between w-full">
                  <Badge style={{ backgroundColor: config.primary, color: 'white' }}>
                    {config.name}
                  </Badge>
                  <span className="text-2xl font-bold">{stats?.brandCounts?.[brand] || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground text-left w-full">Active Accounts</div>
                <div className="flex gap-2 w-full">
                  <MessageSquare className="w-4 h-4" style={{ color: config.primary }} />
                  <Brain className="w-4 h-4" style={{ color: config.secondary }} />
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/unified-upload')}
            >
              <Upload className="w-8 h-8" />
              <div>
                <div className="font-medium">Unified Upload</div>
                <div className="text-xs text-muted-foreground">Upload CSV for all brands</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/deliveries')}
            >
              <Truck className="w-8 h-8" />
              <div>
                <div className="font-medium">Delivery Runs</div>
                <div className="text-xs text-muted-foreground">View multi-brand routes</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/analytics')}
            >
              <BarChart3 className="w-8 h-8" />
              <div>
                <div className="font-medium">Analytics</div>
                <div className="text-xs text-muted-foreground">Cross-brand insights</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/communications')}
            >
              <MessageSquare className="w-8 h-8" />
              <div>
                <div className="font-medium">Communications</div>
                <div className="text-xs text-muted-foreground">Brand messaging</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/ai-insights')}
            >
              <Brain className="w-8 h-8" />
              <div>
                <div className="font-medium">AI Insights</div>
                <div className="text-xs text-muted-foreground">Smart analytics</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/analytics/neighborhoods')}
            >
              <Building className="w-8 h-8" />
              <div>
                <div className="font-medium">Neighborhoods</div>
                <div className="text-xs text-muted-foreground">Store performance by area</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'New store added', store: '282 Nostrand Ave', brands: ['GasMask', 'HotMama'], time: '5 min ago' },
              { action: 'CSV uploaded', store: 'grabba_batch_jan_12.csv', brands: ['All'], time: '1 hour ago' },
              { action: 'Delivery completed', store: 'Brooklyn Smoke Shop', brands: ['GasMask', 'GrabbaRUs'], time: '2 hours ago' }
            ].map((activity, i) => (
              <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <div className="font-medium">{activity.action}</div>
                  <div className="text-sm text-muted-foreground">{activity.store}</div>
                </div>
                <div className="flex items-center gap-2">
                  {activity.brands.map((brand) => {
                    const brandConfig = brandColors[brand as keyof typeof brandColors];
                    return (
                      <Badge
                        key={brand}
                        variant="outline"
                        style={brand !== 'All' && brandConfig ? {
                          borderColor: brandConfig.primary,
                          color: brandConfig.primary
                        } : {}}
                      >
                        {brand}
                      </Badge>
                    );
                  })}
                  <span className="text-xs text-muted-foreground ml-2">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dispatch by Brand */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RouteIcon className="w-5 h-5" /> Dispatch Stores by Brand
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Select stores from a brand cluster and route them in one go.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dispatchBrand} onValueChange={(v) => { setDispatchBrand(v); setSelectedIds([]); }}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {Object.entries(brandColors).map(([brand, cfg]) => (
                  <SelectItem key={brand} value={brand}>{cfg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={selectedIds.length === 0}
              onClick={() => setDispatchStores(selectedIds)}
              className="gap-2 h-9"
            >
              <RouteIcon className="h-4 w-4" /> Dispatch Selected ({selectedIds.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!brandStores || brandStores.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No stores in this cluster.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b mb-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                <span className="text-xs text-muted-foreground">
                  Select all visible ({brandStores.length})
                </span>
              </div>
              <ScrollArea className="h-[360px]">
                <div className="divide-y">
                  {brandStores.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-1 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={selectedIds.includes(s.id)}
                          onCheckedChange={() => toggleOne(s.id)}
                          aria-label={`Select ${s.name}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {[s.city, s.state].filter(Boolean).join(', ')}
                            {s.last_order_date && ` · last order ${new Date(s.last_order_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{s.brand}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDispatchStores([s.id])}
                          title="Add to route"
                        >
                          <RouteIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      <RouteAssignmentDialog
        open={dispatchStores.length > 0}
        onOpenChange={(o) => {
          if (!o) {
            setDispatchStores([]);
            setSelectedIds([]);
          }
        }}
        assigneeId=""
        assigneeName=""
        assigneeType="driver"
        bulkMode={dispatchStores.length > 1}
        preselectedStores={dispatchStores}
      />
    </div>
  );
}
