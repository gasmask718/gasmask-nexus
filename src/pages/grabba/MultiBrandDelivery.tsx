import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Truck, MapPin, Plus, Route, Navigation, Phone,
  Building2, CheckCircle2, AlertTriangle, Zap, Clock,
  Package, Search, X, ChevronRight, Loader2, Users,
  BarChart3, Calendar, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────

interface UnifiedStore {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  brand: string;
  status: string;
  lastVisit: string | null;
  healthScore: number | null;
  contactName: string | null;
  source: 'stores' | 'store_master' | 'leads';
  boro: string | null;
}

// ── Brand Config ───────────────────────────────────────

const BRANDS = ['All Brands', 'GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'] as const;

const BRAND_COLORS: Record<string, string> = {
  'GasMask': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Hot Mama Grabba': 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  'Grabba R Us': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'Hot Scalatti': 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  'default': 'bg-muted text-muted-foreground border-border',
};

function getBrandPill(brand: string) {
  return BRAND_COLORS[brand] || BRAND_COLORS['default'];
}

// ── Sub: Store Pending Triggers ────────────────────────

function StorePendingTriggers({ storeName }: { storeName: string }) {
  const { data: triggers } = useQuery({
    queryKey: ['store-triggers', storeName],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('store_name', storeName)
        .eq('status', 'pending')
        .order('priority_score', { ascending: false });
      return data || [];
    },
    enabled: !!storeName,
  });

  if (!triggers?.length) {
    return <p className="text-xs text-muted-foreground">No pending actions</p>;
  }

  return (
    <div className="space-y-2">
      {triggers.map((t: any) => (
        <div
          key={t.id}
          className={`text-xs p-2 rounded border ${
            t.urgency === 'critical'
              ? 'bg-red-500/10 border-red-500/30'
              : t.urgency === 'high'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-muted/50 border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{t.trigger_type?.replace(/_/g, ' ')}</span>
            <span className={t.urgency === 'critical' ? 'text-red-500' : t.urgency === 'high' ? 'text-amber-500' : 'text-muted-foreground'}>
              {t.urgency}
            </span>
          </div>
          {t.trigger_notes && <p className="text-muted-foreground mt-0.5">{t.trigger_notes}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function MultiBrandDelivery() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState('stores');
  const [activeBrand, setActiveBrand] = useState('All Brands');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [selectedStore, setSelectedStore] = useState<UnifiedStore | null>(null);
  const [showAddStore, setShowAddStore] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // New store form
  const [newStore, setNewStore] = useState({
    name: '', brand: 'GasMask', address: '', city: '', state: '',
    phone: '', contact_name: '', notes: '',
  });

  // ── Queries ──────────────────────────────────────────

  const { data: rawStores = [], isLoading } = useQuery({
    queryKey: ['delivery-command-stores'],
    queryFn: async () => {
      const results: UnifiedStore[] = [];

      // From stores table
      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, phone, status, health_score, last_visit_date, primary_contact_name, boro')
        .is('deleted_at', null)
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .order('name')
        .limit(500);

      if (storeData?.length) {
        results.push(...storeData.map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address_street || '',
          city: s.address_city || '',
          state: s.address_state || '',
          phone: s.phone,
          brand: 'GasMask',
          status: s.status || 'active',
          lastVisit: s.last_visit_date,
          healthScore: s.health_score,
          contactName: s.primary_contact_name,
          source: 'stores' as const,
          boro: s.boro,
        })));
      }

      // From store_master
      const { data: masterData } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state, phone, status, health_status, last_visit_at, contact_name, brand_id')
        .is('deleted_at', null)
        .order('store_name')
        .limit(500);

      if (masterData?.length) {
        const existingNames = new Set(results.map(r => r.name.toLowerCase()));
        for (const s of masterData) {
          if (!existingNames.has(s.store_name.toLowerCase())) {
            results.push({
              id: s.id,
              name: s.store_name,
              address: s.address || '',
              city: s.city || '',
              state: s.state || '',
              phone: s.phone,
              brand: s.brand_id || 'GasMask',
              status: s.status || 'active',
              lastVisit: s.last_visit_at,
              healthScore: null,
              contactName: s.contact_name,
              source: 'store_master',
              boro: null,
            });
          }
        }
      }

      return results;
    },
    refetchInterval: 60000,
  });

  // Pending triggers
  const { data: allTriggers = [] } = useQuery({
    queryKey: ['delivery-triggers-all'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('gasmask_visit_triggers')
        .select('id, store_name, store_city, store_state, trigger_type, urgency, priority_score, trigger_notes, status, created_at, floor_source')
        .in('status', ['pending', 'scheduled', 'in_route'])
        .order('priority_score', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const criticalTriggers = allTriggers.filter((t: any) => t.urgency === 'critical');
  const pendingTriggerCount = allTriggers.length;

  // Routes today (canonical routes table, gasmask_agent source)
  const { data: routesToday = [] } = useQuery({
    queryKey: ['delivery-routes-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await (supabase as any)
        .from('routes')
        .select('*')
        .eq('source', 'gasmask_agent')
        .eq('date', today);
      return data || [];
    },
  });

  // ── Derived Data ─────────────────────────────────────

  // Enrich stores with trigger info
  const stores = useMemo(() => {
    const triggerMap = new Map<string, any[]>();
    for (const t of allTriggers) {
      const key = t.store_name?.toLowerCase();
      if (!triggerMap.has(key)) triggerMap.set(key, []);
      triggerMap.get(key)!.push(t);
    }

    return rawStores.map(s => {
      const storeTriggers = triggerMap.get(s.name.toLowerCase()) || [];
      const hasCritical = storeTriggers.some((t: any) => t.urgency === 'critical');
      const hasHigh = storeTriggers.some((t: any) => t.urgency === 'high');
      return { ...s, triggerCount: storeTriggers.length, hasCritical, hasHigh };
    });
  }, [rawStores, allTriggers]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    let list = stores;

    if (activeBrand !== 'All Brands') {
      list = list.filter(s => s.brand === activeBrand);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'active') list = list.filter(s => s.status === 'active');
    else if (statusFilter === 'needs_visit') list = list.filter(s => s.triggerCount > 0);
    else if (statusFilter === 'critical') list = list.filter(s => s.hasCritical);
    if (cityFilter !== 'all') list = list.filter(s => s.city === cityFilter);

    return list;
  }, [stores, activeBrand, search, statusFilter, cityFilter]);

  const uniqueCities = useMemo(() => {
    const cities = [...new Set(stores.map(s => s.city).filter(Boolean))].sort();
    return cities;
  }, [stores]);

  // Paginated
  const paginatedStores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, page]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / pageSize));

  // KPIs
  const activeCount = stores.filter(s => s.status === 'active').length;
  const needsVisitCount = stores.filter(s => s.triggerCount > 0).length;
  const criticalCount = stores.filter(s => s.hasCritical).length;
  const onRouteToday = routesToday.reduce((sum: number, r: any) => sum + (r.total_stops || 0), 0);
  const lowStockTriggers = allTriggers.filter((t: any) => t.trigger_type === 'restock').length;
  const overdueTriggers = allTriggers.filter((t: any) => {
    if (!t.created_at) return false;
    const age = Date.now() - new Date(t.created_at).getTime();
    return age > 3 * 24 * 60 * 60 * 1000; // > 3 days
  }).length;

  // ── Actions ──────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedStores(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const bulkAddTriggers = async () => {
    const storeList = stores.filter(s => selectedStores.has(s.id));
    for (const store of storeList) {
      await supabase.functions.invoke('gasmask-route-agent', {
        body: {
          action: 'create_trigger',
          store_name: store.name,
          store_city: store.city,
          store_state: store.state,
          store_phone: store.phone,
          store_address: store.address,
          trigger_source: 'Multi-Brand Delivery Command',
          trigger_type: 'follow_up',
          floor_source: 'floor4_delivery',
          urgency: 'normal',
          priority_score: 5,
          trigger_notes: 'Bulk visit trigger from delivery command center',
        },
      });
    }
    toast.success(`${storeList.length} visit triggers created`);
    setSelectedStores(new Set());
    queryClient.invalidateQueries({ queryKey: ['delivery-triggers-all'] });
  };

  const bulkSendSMS = async () => {
    const storeList = stores.filter(s => selectedStores.has(s.id) && s.phone);
    for (const store of storeList) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to_number: store.phone,
          message_body: `Hi ${store.name}, this is a message from your distribution team. We will be in your area soon. Please let us know if you need anything.`,
          idempotency_key: `bulk-delivery-${store.id}-${Date.now()}`,
        },
      });
    }
    toast.success(`SMS sent to ${storeList.length} stores`);
  };

  const createTriggerForStore = async (store: UnifiedStore) => {
    try {
      await supabase.functions.invoke('gasmask-route-agent', {
        body: {
          action: 'create_trigger',
          store_name: store.name,
          store_city: store.city,
          store_state: store.state,
          store_phone: store.phone,
          store_address: store.address,
          trigger_source: 'Manual — Delivery Command',
          trigger_type: 'follow_up',
          floor_source: 'floor4_delivery',
          urgency: 'normal',
          priority_score: 5,
          trigger_notes: 'Created from delivery command center',
        },
      });
      toast.success('Visit trigger created');
      queryClient.invalidateQueries({ queryKey: ['delivery-triggers-all'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create trigger');
    }
  };

  const handleAddStore = async () => {
    if (!newStore.name) { toast.error('Store name required'); return; }
    try {
      const { error } = await supabase.from('store_master').insert({
        store_name: newStore.name,
        address: newStore.address,
        city: newStore.city,
        state: newStore.state || 'NY',
        zip: '00000',
        phone: newStore.phone || null,
        contact_name: newStore.contact_name || null,
        notes: newStore.notes || null,
        brand_id: newStore.brand,
        status: 'active',
      });
      if (error) throw error;
      toast.success('Store added');
      setShowAddStore(false);
      setNewStore({ name: '', brand: 'GasMask', address: '', city: '', state: '', phone: '', contact_name: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['delivery-command-stores'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add store');
    }
  };

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Multi-Brand Delivery Command
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {['GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'].map(brand => (
              <span key={brand} className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                {brand}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => navigate('/gasmask/route-engine')} className="gap-1.5 text-xs">
            <Route className="h-3.5 w-3.5" />
            Route Engine
            {pendingTriggerCount > 0 && (
              <Badge className="h-4 text-[9px] px-1 bg-destructive text-destructive-foreground border-0">{pendingTriggerCount}</Badge>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const { data } = await supabase.functions.invoke('gasmask-opportunity-sync');
              toast.success(`${data?.total_triggers_created || 0} new visit triggers added`);
              queryClient.invalidateQueries({ queryKey: ['delivery-triggers-all'] });
            } catch (err: any) { toast.error(err.message); }
          }} className="gap-1.5 text-xs">
            <Navigation className="h-3.5 w-3.5" />
            Pull Opportunities
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/gasmask/driver-route')} className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            Driver View
          </Button>
          <Button size="sm" onClick={() => setShowAddStore(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Store
          </Button>
        </div>
      </div>

      {/* ── CRITICAL ALERT BANNER ── */}
      {criticalTriggers.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-red-500">
              {criticalTriggers.length} stores need urgent visits:
            </span>{' '}
            <span className="text-muted-foreground">
              {criticalTriggers.slice(0, 5).map((t: any) => t.store_name).join(' · ')}
              {criticalTriggers.length > 5 && ` +${criticalTriggers.length - 5} more`}
            </span>
          </div>
          <Button size="sm" variant="destructive" className="text-xs" onClick={() => navigate('/gasmask/route-engine')}>
            Build Route
          </Button>
        </div>
      )}

      {/* ── KPI STRIP ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { label: 'Total Stores', value: stores.length, icon: Building2, color: 'text-foreground', filterFn: () => setStatusFilter('all') },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-emerald-500', filterFn: () => setStatusFilter('active') },
          { label: 'Need Visit', value: needsVisitCount, icon: AlertTriangle, color: 'text-amber-500', filterFn: () => setStatusFilter('needs_visit') },
          { label: 'Critical', value: criticalCount, icon: Zap, color: 'text-red-500', filterFn: () => setStatusFilter('critical') },
          { label: 'On Route', value: onRouteToday, icon: Truck, color: 'text-blue-500', filterFn: () => setActiveTab('queue') },
          { label: 'Low Stock', value: lowStockTriggers, icon: Package, color: 'text-orange-500', filterFn: () => {} },
          { label: 'Overdue', value: overdueTriggers, icon: Clock, color: 'text-red-400', filterFn: () => {} },
        ].map(kpi => (
          <button
            key={kpi.label}
            onClick={kpi.filterFn}
            className="flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors min-w-[90px]"
          >
            <kpi.icon className={`h-4 w-4 ${kpi.color} mb-1`} />
            <span className={`text-lg font-bold leading-none ${kpi.color}`}>{kpi.value}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</span>
          </button>
        ))}
      </div>

      {/* ── BRAND FILTER ── */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {BRANDS.map(brand => (
          <button
            key={brand}
            onClick={() => { setActiveBrand(brand); setPage(1); }}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeBrand === brand
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {brand}
            <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">
              {brand === 'All Brands' ? stores.length : stores.filter(s => s.brand === brand).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── MAIN TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="stores" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> All Stores
          </TabsTrigger>
          <TabsTrigger value="queue" className="text-xs gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Delivery Queue
            {pendingTriggerCount > 0 && (
              <Badge className="h-4 text-[9px] px-1 bg-amber-500 text-white border-0 ml-1">{pendingTriggerCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="planner" className="text-xs gap-1.5">
            <Route className="h-3.5 w-3.5" /> Route Planner
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: ALL STORES ── */}
        <TabsContent value="stores" className="mt-3 space-y-3">
          {/* Filter bar */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search stores, cities..."
                className="h-8 w-52 text-xs pl-7"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="needs_visit">Needs Visit</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cityFilter} onValueChange={v => { setCityFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Cities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter !== 'all' || cityFilter !== 'all') && (
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => { setSearch(''); setStatusFilter('all'); setCityFilter('all'); }}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filteredStores.length} stores</span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stores...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="w-10 px-3 py-2.5">
                        <Checkbox
                          checked={paginatedStores.length > 0 && paginatedStores.every(s => selectedStores.has(s.id))}
                          onCheckedChange={checked => {
                            if (checked) setSelectedStores(new Set(paginatedStores.map(s => s.id)));
                            else setSelectedStores(new Set());
                          }}
                        />
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Store</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Brand</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Location</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Last Visit</th>
                      <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Pending</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStores.map(store => (
                      <tr
                        key={store.id}
                        className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                          store.hasCritical ? 'border-l-2 border-l-red-500' : store.hasHigh ? 'border-l-2 border-l-amber-500' : ''
                        }`}
                        onClick={() => setSelectedStore(store)}
                      >
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedStores.has(store.id)}
                            onCheckedChange={() => toggleSelect(store.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-sm">{store.name}</div>
                          {store.contactName && <div className="text-[10px] text-muted-foreground">{store.contactName}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getBrandPill(store.brand)}`}>
                            {store.brand}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {[store.city, store.state].filter(Boolean).join(', ')}
                          {store.boro && <span className="ml-1 text-[10px]">({store.boro})</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-[10px] ${
                            store.status === 'active' ? 'text-emerald-500 border-emerald-500/30' :
                            store.hasCritical ? 'text-red-500 border-red-500/30' :
                            'text-muted-foreground'
                          }`}>
                            {store.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {store.lastVisit ? formatDistanceToNow(new Date(store.lastVisit), { addSuffix: true }) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {store.triggerCount > 0 ? (
                            <Badge className={`text-[10px] ${store.hasCritical ? 'bg-red-500/15 text-red-500 border-red-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}`}>
                              {store.triggerCount} pending
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => createTriggerForStore(store)} title="Queue visit">
                              <Truck className="h-3.5 w-3.5" />
                            </Button>
                            {store.phone && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                <a href={`tel:${store.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedStore(store)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedStores.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground text-sm">
                          {isLoading ? 'Loading...' : 'No stores match your filters'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs">
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages} · {filteredStores.length} stores
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB: DELIVERY QUEUE ── */}
        <TabsContent value="queue" className="mt-3 space-y-4">
          {/* Urgent */}
          {criticalTriggers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-500 mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Urgent Deliveries ({criticalTriggers.length})
              </h3>
              <div className="space-y-2">
                {criticalTriggers.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors">
                    <div className="w-1 self-stretch rounded-full bg-red-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t.store_name}</span>
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">critical</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.store_city}, {t.store_state} · {t.trigger_type?.replace(/_/g, ' ')}
                      </p>
                      {t.trigger_notes && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.trigger_notes}</p>}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('/gasmask/route-engine')}>+ Route</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High priority */}
          {(() => {
            const highTriggers = allTriggers.filter((t: any) => t.urgency === 'high');
            if (!highTriggers.length) return null;
            return (
              <div>
                <h3 className="text-sm font-medium text-amber-500 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> High Priority ({highTriggers.length})
                </h3>
                <div className="space-y-2">
                  {highTriggers.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-1 self-stretch rounded-full bg-amber-500" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{t.store_name}</span>
                        <p className="text-xs text-muted-foreground">
                          {t.store_city}, {t.store_state} · {t.trigger_type?.replace(/_/g, ' ')}
                        </p>
                        {t.trigger_notes && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.trigger_notes}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('/gasmask/route-engine')}>+ Route</Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Normal */}
          {(() => {
            const normalTriggers = allTriggers.filter((t: any) => !['critical', 'high'].includes(t.urgency));
            if (!normalTriggers.length) return null;
            return (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Upcoming ({normalTriggers.length})
                </h3>
                <div className="space-y-2">
                  {normalTriggers.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-1 self-stretch rounded-full bg-muted-foreground/30" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{t.store_name}</span>
                        <p className="text-xs text-muted-foreground">
                          {t.store_city}, {t.store_state} · {t.trigger_type?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('/gasmask/route-engine')}>+ Route</Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {allTriggers.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pending deliveries</p>
              <p className="text-xs mt-1">Create visit triggers from the stores tab or Route Engine</p>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: ANALYTICS ── */}
        <TabsContent value="analytics" className="mt-3 space-y-4">
          {/* By brand */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'].map(brand => {
              const brandStores = stores.filter(s => s.brand === brand);
              const brandTriggers = allTriggers.filter((t: any) =>
                brandStores.some(s => s.name.toLowerCase() === t.store_name?.toLowerCase())
              );
              return (
                <Card key={brand}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getBrandPill(brand)}`}>{brand}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <span className="text-muted-foreground">Stores</span>
                      <span className="font-medium text-right">{brandStores.length}</span>
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-right">{brandTriggers.length}</span>
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-medium text-right">{brandStores.filter(s => s.status === 'active').length}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Trigger type breakdown */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Triggers by Type</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {(() => {
                  const typeCounts: Record<string, number> = allTriggers.reduce((acc: Record<string, number>, t: any) => {
                    const type = t.trigger_type || 'other';
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);
                  const vals = Object.values(typeCounts) as number[];
                  const maxCount = vals.length > 0 ? Math.max(...vals) : 1;
                  return Object.entries(typeCounts).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3 text-xs">
                      <span className="w-24 text-muted-foreground truncate">{type.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${((count as number) / maxCount) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-medium">{count as number}</span>
                    </div>
                  ));
                })()}
                {allTriggers.length === 0 && <p className="text-xs text-muted-foreground">No trigger data yet</p>}
              </div>
            </CardContent>
          </Card>

          {/* Top stores needing attention */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Top Stores Needing Visits</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {stores
                  .filter(s => s.triggerCount > 0)
                  .sort((a, b) => b.triggerCount - a.triggerCount)
                  .slice(0, 10)
                  .map(store => (
                    <div key={store.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium">{store.name}</span>
                        <span className="text-muted-foreground ml-2">{store.city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${store.hasCritical ? 'text-red-500 border-red-500/30' : 'text-amber-500 border-amber-500/30'}`}>
                          {store.triggerCount} pending
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedStore(store)}>View</Button>
                      </div>
                    </div>
                  ))}
                {stores.filter(s => s.triggerCount > 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">All stores are up to date</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: ROUTE PLANNER ── */}
        <TabsContent value="planner" className="mt-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">
                {selectedStores.size > 0 ? `Building route for ${selectedStores.size} stores` : 'Select stores to build a route'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select stores from the All Stores tab, or use quick selects below
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                const critIds = stores.filter(s => s.hasCritical).map(s => s.id);
                setSelectedStores(new Set(critIds));
              }}>Select All Critical</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                const visitIds = stores.filter(s => s.triggerCount > 0).map(s => s.id);
                setSelectedStores(new Set(visitIds));
              }}>Select Needs Visit</Button>
            </div>
          </div>

          {selectedStores.size > 0 ? (
            <div className="space-y-3">
              <div className="border rounded-lg divide-y">
                {stores.filter(s => selectedStores.has(s.id)).map((store, i) => (
                  <div key={store.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <div className="flex-1">
                      <span className="font-medium">{store.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{store.city}, {store.state}</span>
                    </div>
                    {store.triggerCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">{store.triggerCount} pending</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleSelect(store.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="w-full gap-2" onClick={() => navigate('/gasmask/route-engine')}>
                <Route className="h-4 w-4" />
                Open in Route Engine to Build & Dispatch
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Route className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No stores selected</p>
              <p className="text-xs mt-1">Go to All Stores tab and check stores, or use quick selects above</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── FLOATING SELECTION BAR ── */}
      {selectedStores.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border rounded-full px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium">{selectedStores.size} stores selected</span>
          <Button size="sm" variant="outline" className="text-xs rounded-full h-7 gap-1" onClick={() => setActiveTab('planner')}>
            <Route className="h-3 w-3" /> Plan Route
          </Button>
          <Button size="sm" variant="outline" className="text-xs rounded-full h-7" onClick={bulkAddTriggers}>
            📍 Add Visit Triggers
          </Button>
          <Button size="sm" variant="outline" className="text-xs rounded-full h-7" onClick={bulkSendSMS}>
            📱 SMS All
          </Button>
          <Button size="sm" variant="ghost" className="text-xs rounded-full h-7" onClick={() => setSelectedStores(new Set())}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ── STORE DETAIL SHEET ── */}
      <Sheet open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{selectedStore?.name}</SheetTitle>
            <div className="flex gap-2 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getBrandPill(selectedStore?.brand || '')}`}>
                {selectedStore?.brand}
              </span>
              <Badge variant="outline" className="text-[10px]">{selectedStore?.status}</Badge>
            </div>
          </SheetHeader>

          <div className="space-y-5 mt-5">
            {/* Contact */}
            <div className="space-y-2 text-sm">
              {selectedStore?.address && (
                <div className="flex gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{selectedStore.address}<br />{selectedStore.city}, {selectedStore.state}</span>
                </div>
              )}
              {selectedStore?.phone && (
                <div className="flex gap-2 items-center">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${selectedStore.phone}`} className="hover:underline">{selectedStore.phone}</a>
                </div>
              )}
              {selectedStore?.contactName && (
                <div className="flex gap-2 items-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedStore.contactName}</span>
                </div>
              )}
              {selectedStore?.lastVisit && (
                <div className="flex gap-2 items-center text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Last visit: {formatDistanceToNow(new Date(selectedStore.lastVisit), { addSuffix: true })}</span>
                </div>
              )}
            </div>

            {/* Pending triggers */}
            <div>
              <h3 className="text-sm font-medium mb-2">Pending Actions</h3>
              {selectedStore && <StorePendingTriggers storeName={selectedStore.name} />}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button className="w-full" size="sm" onClick={() => selectedStore && createTriggerForStore(selectedStore)}>
                <Plus className="h-4 w-4 mr-2" /> Create Visit Trigger
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/gasmask/route-engine')}>
                  <Route className="h-3.5 w-3.5 mr-1" /> Add to Route
                </Button>
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent((selectedStore?.address || '') + ' ' + (selectedStore?.city || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-3.5 w-3.5 mr-1" /> Directions
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── ADD STORE SHEET ── */}
      <Sheet open={showAddStore} onOpenChange={setShowAddStore}>
        <SheetContent className="w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Store</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Store Name *</label>
              <Input className="h-8 text-sm mt-1" value={newStore.name} onChange={e => setNewStore(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Brand</label>
              <Select value={newStore.brand} onValueChange={v => setNewStore(p => ({ ...p, brand: v }))}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'].map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Address</label>
              <Input className="h-8 text-sm mt-1" value={newStore.address} onChange={e => setNewStore(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <Input className="h-8 text-sm mt-1" value={newStore.city} onChange={e => setNewStore(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">State</label>
                <Input className="h-8 text-sm mt-1" value={newStore.state} onChange={e => setNewStore(p => ({ ...p, state: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input className="h-8 text-sm mt-1" value={newStore.phone} onChange={e => setNewStore(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
              <Input className="h-8 text-sm mt-1" value={newStore.contact_name} onChange={e => setNewStore(p => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input className="h-8 text-sm mt-1" value={newStore.notes} onChange={e => setNewStore(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full mt-2" onClick={handleAddStore}>
              <Plus className="h-4 w-4 mr-2" /> Add Store
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
