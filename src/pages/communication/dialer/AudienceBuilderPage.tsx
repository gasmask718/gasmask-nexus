import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Phone, Users, Search, Filter, Download, Plus, PhoneCall,
  Ban, CheckCircle2, MapPin, Store, Target, Zap, ListPlus
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { exportData } from '@/utils/exportUtils';

interface CallableEntity {
  entity_type: string;
  entity_id: string;
  display_name: string;
  phone_e164: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string;
  last_order_at: string | null;
  is_dnc: boolean;
  callable_now: boolean;
  territory_id: string | null;
}

export default function AudienceBuilderPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const bizId = currentBusiness?.id;

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [callableOnly, setCallableOnly] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [noDncOnly, setNoDncOnly] = useState(false);
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch callable entities
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['callable-entities', bizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_callable_entities' as any)
        .select('*')
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as CallableEntity[];
    },
    enabled: !!bizId,
  });

  // Get unique states for filter
  const states = useMemo(() => {
    const s = new Set(entities.map(e => e.state).filter(Boolean));
    return Array.from(s).sort();
  }, [entities]);

  // Filter entities
  const filtered = useMemo(() => {
    return entities.filter(e => {
      if (tab === 'stores' && e.entity_type !== 'store') return false;
      if (tab === 'prospects' && e.entity_type !== 'prospect') return false;
      if (callableOnly && !e.callable_now) return false;
      if (hasPhoneOnly && !e.phone_e164) return false;
      if (noDncOnly && e.is_dnc) return false;
      if (stateFilter !== 'all' && e.state !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.display_name?.toLowerCase().includes(q) ||
          e.phone_e164?.includes(q) ||
          e.city?.toLowerCase().includes(q) ||
          e.address?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entities, tab, callableOnly, hasPhoneOnly, noDncOnly, stateFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map(e => e.entity_id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedEntities = filtered.filter(e => selectedIds.has(e.entity_id));

  // Add to queue
  const addToQueue = async () => {
    if (!bizId || selectedEntities.length === 0) return;
    const items = selectedEntities
      .filter(e => e.phone_e164 && !e.is_dnc)
      .map((e, i) => ({
        business_id: bizId,
        phone_number: e.phone_e164!,
        contact_name: e.display_name,
        store_id: e.entity_type === 'store' ? e.entity_id : null,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        source_reason: e.entity_type === 'store' ? 'active_store' : 'prospect',
        priority_score: Math.max(1, 100 - i),
        status: 'queued',
      }));

    if (items.length === 0) {
      toast.error('No callable entities selected (need phone + not DNC)');
      return;
    }

    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await supabase.from('outbound_call_queue').insert(batch as any);
    }

    toast.success(`Added ${items.length} to queue`);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
  };

  const handleExport = () => {
    const data = (selectedEntities.length > 0 ? selectedEntities : filtered).map(e => ({
      type: e.entity_type,
      name: e.display_name,
      phone: e.phone_e164 || '',
      address: e.address || '',
      city: e.city || '',
      state: e.state || '',
      status: e.status,
      dnc: e.is_dnc ? 'Yes' : 'No',
    }));
    exportData({ filename: 'audience-export', format: 'csv', data });
    toast.success('Exported');
  };

  const storeCount = entities.filter(e => e.entity_type === 'store').length;
  const prospectCount = entities.filter(e => e.entity_type === 'prospect').length;
  const callableCount = entities.filter(e => e.callable_now).length;

  return (
    <div className="w-full min-h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Audience Builder
          </h2>
          <p className="text-sm text-muted-foreground">
            Build callable lists from stores & prospects. Select → Add to Queue → Run Console.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/communication/dialer-console')}>
            <Zap className="h-4 w-4 mr-1" /> Run Console
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/communication/campaign-wizard')}>
            <Target className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{storeCount}</p>
          <p className="text-xs text-muted-foreground">Active Stores</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{prospectCount}</p>
          <p className="text-xs text-muted-foreground">Prospects</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{callableCount}</p>
          <p className="text-xs text-muted-foreground">Callable Now</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Filtered Results</p>
        </CardContent></Card>
      </div>

      {/* Tabs + Filters */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="all">All ({entities.length})</TabsTrigger>
            <TabsTrigger value="stores">Stores ({storeCount})</TabsTrigger>
            <TabsTrigger value="prospects">Prospects ({prospectCount})</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, city..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-[220px]"
              />
            </div>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-4 flex-wrap mt-3 p-3 border rounded-lg bg-muted/30">
          <Filter className="h-4 w-4 text-muted-foreground" />

          <div className="flex items-center gap-2">
            <Switch id="callable" checked={callableOnly} onCheckedChange={setCallableOnly} />
            <Label htmlFor="callable" className="text-xs">Callable Now</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="hasPhone" checked={hasPhoneOnly} onCheckedChange={setHasPhoneOnly} />
            <Label htmlFor="hasPhone" className="text-xs">Has Phone</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="noDnc" checked={noDncOnly} onCheckedChange={setNoDncOnly} />
            <Label htmlFor="noDnc" className="text-xs">Not DNC</Label>
          </div>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map(s => (
                <SelectItem key={s} value={s!}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button size="sm" onClick={addToQueue} className="gap-1">
              <ListPlus className="h-3.5 w-3.5" /> Add to Queue
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          </div>
        )}

        {/* Entity List */}
        <TabsContent value={tab} className="mt-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {filtered.length} results
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                Select All ({filtered.length})
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No results match your filters</div>
                  ) : (
                    filtered.map(entity => (
                      <div
                        key={entity.entity_id}
                        className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
                          selectedIds.has(entity.entity_id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <Checkbox
                          checked={selectedIds.has(entity.entity_id)}
                          onCheckedChange={() => toggleSelect(entity.entity_id)}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{entity.display_name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {entity.entity_type === 'store' ? (
                                <><Store className="h-2.5 w-2.5 mr-0.5" /> Store</>
                              ) : (
                                <><Target className="h-2.5 w-2.5 mr-0.5" /> Prospect</>
                              )}
                            </Badge>
                            {entity.callable_now && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Callable
                              </Badge>
                            )}
                            {entity.is_dnc && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                <Ban className="h-2.5 w-2.5 mr-0.5" /> DNC
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {entity.phone_e164 && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {entity.phone_e164}
                              </span>
                            )}
                            {entity.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {entity.city}, {entity.state}
                              </span>
                            )}
                            {entity.last_order_at && (
                              <span>Last order: {new Date(entity.last_order_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!entity.phone_e164 || entity.is_dnc}
                          onClick={() => {
                            toast.info(`Calling ${entity.display_name}...`);
                          }}
                          className="gap-1 text-xs"
                        >
                          <PhoneCall className="h-3.5 w-3.5" /> Call
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
