import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Store, Phone, User, Heart } from 'lucide-react';

interface TerritoryStoresTableProps {
  cityFilter: string;
  stateFilter: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  inactive: 'bg-muted text-muted-foreground border-border',
  prospect: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  churned: 'bg-destructive/15 text-destructive border-destructive/30',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-500',
  'at-risk': 'bg-amber-500/15 text-amber-500',
  critical: 'bg-destructive/15 text-destructive',
};

export function TerritoryStoresTable({ cityFilter, stateFilter }: TerritoryStoresTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: stores, isLoading } = useQuery({
    queryKey: ['territory-stores', cityFilter, stateFilter],
    queryFn: async () => {
      let query = supabase
        .from('store_master')
        .select('id, store_name, address, city, state, zip, phone, owner_name, status, health_status, store_type, last_visit_at, last_order_at')
        .is('deleted_at', null)
        .order('store_name', { ascending: true })
        .limit(500);

      if (cityFilter !== 'all') query = query.eq('city', cityFilter);
      if (stateFilter !== 'all') query = query.eq('state', stateFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (stores || []).filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.store_name.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.owner_name?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    }
    return true;
  });

  const statusCounts = (stores || []).reduce<Record<string, number>>((acc, s) => {
    const st = s.status || 'unknown';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            Stores in Territory
            <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-[200px] text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status ({stores?.length || 0})</SelectItem>
                {Object.entries(statusCounts).map(([status, count]) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {stores?.length === 0
              ? 'No stores found in this territory. Promote candidates from Territory Intelligence.'
              : 'No stores match your search/filter criteria.'}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.store_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {store.address}, {store.city}, {store.state} {store.zip}
                    </TableCell>
                    <TableCell>
                      {store.owner_name ? (
                        <span className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {store.owner_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {store.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {store.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[store.status || ''] || ''}>
                        {store.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {store.health_status ? (
                        <Badge variant="secondary" className={HEALTH_COLORS[store.health_status] || ''}>
                          <Heart className="h-3 w-3 mr-1" />
                          {store.health_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{store.store_type || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {store.last_visit_at
                        ? new Date(store.last_visit_at).toLocaleDateString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
