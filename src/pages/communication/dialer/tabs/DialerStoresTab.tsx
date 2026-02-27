import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone, Search, PhoneCall, Ban, CheckCircle2, MapPin,
  ChevronLeft, ChevronRight, ListPlus, Download, Filter
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { exportData } from '@/utils/exportUtils';

const PAGE_SIZE = 50;
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function DialerStoresTab() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [noDncOnly, setNoDncOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => { setDebouncedSearch(val); setPage(0); }, 300);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['dialer-stores', debouncedSearch, stateFilter, hasPhoneOnly, noDncOnly, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_callable_stores', {
        p_search: debouncedSearch,
        p_state: stateFilter,
        p_has_phone: hasPhoneOnly,
        p_not_dnc: noDncOnly,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return data as any[];
    },
  });

  const stores = data || [];
  const totalCount = stores.length > 0 ? Number(stores[0].total_count) : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => setSelectedIds(new Set(stores.map(s => s.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const addToQueue = async () => {
    const selected = stores.filter(s => selectedIds.has(s.id) && s.phone && !s.do_not_call);
    if (selected.length === 0) { toast.error('No callable stores selected'); return; }
    const items = selected.map((s, i) => ({
      business_id: currentBusiness?.id,
      phone_number: s.phone,
      contact_name: s.store_name,
      store_id: s.id,
      entity_type: 'store',
      entity_id: s.id,
      source_reason: 'active_store',
      priority_score: Math.max(1, 100 - i),
      status: 'queued',
    }));
    for (let i = 0; i < items.length; i += 50) {
      await supabase.from('outbound_call_queue').insert(items.slice(i, i + 50) as any);
    }
    toast.success(`${items.length} stores added to queue`);
    clearSelection();
  };

  const handleExport = () => {
    const rows = (selectedIds.size > 0 ? stores.filter(s => selectedIds.has(s.id)) : stores)
      .map(s => ({ name: s.store_name, owner: s.owner_name, phone: s.phone || '', city: s.city || '', state: s.state || '', dnc: s.do_not_call ? 'Yes' : 'No' }));
    exportData({ filename: 'stores-export', format: 'csv', data: rows });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap p-3 border rounded-lg bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, city..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={stateFilter} onValueChange={v => { setStateFilter(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="hp-tab" checked={hasPhoneOnly} onCheckedChange={v => { setHasPhoneOnly(v); setPage(0); }} />
          <Label htmlFor="hp-tab" className="text-xs">Has Phone</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="nd-tab" checked={noDncOnly} onCheckedChange={v => { setNoDncOnly(v); setPage(0); }} />
          <Label htmlFor="nd-tab" className="text-xs">Not DNC</Label>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-primary/5 border-primary/20">
          <Badge variant="secondary">{selectedIds.size} selected</Badge>
          <Button size="sm" onClick={addToQueue} className="gap-1"><ListPlus className="h-3.5 w-3.5" /> Add to Queue</Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1"><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{stores.length} shown of {totalCount.toLocaleString()} · Page {page + 1}/{totalPages}</CardTitle>
          <Button variant="ghost" size="sm" onClick={selectAll}>Select Page</Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="divide-y">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading stores...</div>
              ) : stores.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No stores match filters</div>
              ) : stores.map(store => (
                <div key={store.id} className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${selectedIds.has(store.id) ? 'bg-primary/5' : ''}`}>
                  <Checkbox checked={selectedIds.has(store.id)} onCheckedChange={() => toggleSelect(store.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{store.store_name}</span>
                      {store.do_not_call && <Badge variant="destructive" className="text-[10px] px-1.5 py-0"><Ban className="h-2.5 w-2.5 mr-0.5" /> DNC</Badge>}
                      {store.phone && !store.do_not_call && <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Callable</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {store.owner_name && <span>{store.owner_name}</span>}
                      {store.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {store.phone}</span>}
                      {store.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {store.city}, {store.state}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" disabled={!store.phone || store.do_not_call}
                    onClick={() => toast.info(`Calling ${store.store_name}...`)} className="gap-1 text-xs">
                    <PhoneCall className="h-3.5 w-3.5" /> Call
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm font-medium px-2">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
