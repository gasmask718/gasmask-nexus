import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  getUFTVendorsList,
  updateUFTVendorStatus,
  type UFTVendorListItem,
} from '@/services/uftApi';

const TYPE_TABS = ['all', 'venue', 'staff', 'rental'] as const;
type TypeTab = typeof TYPE_TABS[number];

const TYPE_COLORS: Record<string, string> = {
  venue: 'bg-blue-500/20 text-blue-400',
  staff: 'bg-purple-500/20 text-purple-400',
  rental: 'bg-green-500/20 text-green-400',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  suspended: 'bg-red-500/20 text-red-400',
};

const PAGE_SIZE = 20;

export default function UFTVendors() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TypeTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uft-vendors-list', tab, page],
    queryFn: () => getUFTVendorsList(tab === 'all' ? undefined : tab, PAGE_SIZE, page * PAGE_SIZE),
  });

  const vendors = data?.vendors ?? [];
  const total = data?.total ?? vendors.length;

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = !search ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.city?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status?.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [vendors, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vendors.length, venue: 0, staff: 0, rental: 0 };
    vendors.forEach(v => { c[v.vendor_type] = (c[v.vendor_type] || 0) + 1; });
    return c;
  }, [vendors]);

  const handleStatus = async (v: UFTVendorListItem, status: string) => {
    if (status === 'suspended' && !confirm(`Suspend ${v.name}? They will not appear in search results.`)) return;
    setBusy(v.id);
    try {
      await updateUFTVendorStatus(v.id, v.vendor_type, status);
      toast.success(`Vendor ${status}`);
      qc.invalidateQueries({ queryKey: ['uft-vendors-list'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Store className="h-7 w-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <p className="text-sm text-muted-foreground">Unforgettable Times vendor directory</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TypeTab); setPage(0); }}>
        <TabsList>
          {TYPE_TABS.map(t => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === 'all' ? 'All' : `${t}s`} <span className="ml-1 text-xs opacity-60">({counts[t] ?? 0})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendors</CardTitle></CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-yellow-400 mb-3">Could not load vendors. {(error as Error).message}</p>
          )}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No vendors match your filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={`${v.vendor_type}-${v.id}`}>
                    <TableCell>
                      {v.cover_photo ? (
                        <img src={v.cover_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">
                          {v.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{v.name}</div>
                      {v.business_name && <div className="text-xs text-muted-foreground">{v.business_name}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${TYPE_COLORS[v.vendor_type]}`}>
                        {v.vendor_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{v.city}{v.state ? `, ${v.state}` : ''}</TableCell>
                    <TableCell className="text-right text-sm">
                      {v.review_count > 0 ? `⭐ ${v.rating?.toFixed(1)} (${v.review_count})` : <span className="text-muted-foreground">No reviews</span>}
                    </TableCell>
                    <TableCell className="text-right">{v.bookings_count ?? 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[v.status?.toLowerCase()] || 'bg-muted'}`}>
                        {v.status}
                      </span>
                    </TableCell>
                    <TableCell>{v.verified ? '✅' : '⏳'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`https://pxylmrmwqmxotqffejbe.supabase.co`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> View
                        </a>
                      </Button>
                      {!v.verified && (
                        <Button size="sm" variant="outline" onClick={() => navigate('/uft/verification')}>Verify</Button>
                      )}
                      {v.status?.toLowerCase() === 'suspended' ? (
                        <Button size="sm" variant="outline" disabled={busy === v.id}
                          onClick={() => handleStatus(v, 'active')}>Activate</Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy === v.id}
                          onClick={() => handleStatus(v, 'suspended')}>Suspend</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total} vendors
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
