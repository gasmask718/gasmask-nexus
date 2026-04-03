import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CalendarCheck, DollarSign, TrendingUp, XCircle, Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ExportButton } from '@/components/crud/ExportButton';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-400',
  cancelled: 'bg-red-500/20 text-red-400',
  completed: 'bg-blue-500/20 text-blue-400',
};

const PAGE_SIZE = 25;

export default function TTBookings() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['tt-all-bookings', statusFilter, serviceFilter, sortCol, sortDir],
    queryFn: async () => {
      let q = supabase.from('tt_bookings').select('*');
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (serviceFilter !== 'all') q = q.eq('service_type', serviceFilter);
      q = q.order(sortCol, { ascending: sortDir === 'asc' });
      const { data } = await q.limit(500);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    if (!bookings) return [];
    if (!search) return bookings;
    const s = search.toLowerCase();
    return bookings.filter(b => 
      b.client_name?.toLowerCase().includes(s) || 
      b.service_name?.toLowerCase().includes(s) ||
      b.id?.toLowerCase().includes(s)
    );
  }, [bookings, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const metrics = useMemo(() => {
    if (!filtered.length) return { total: 0, revenue: 0, avg: 0, confirmed: 0, cancelled: 0 };
    const revenue = filtered.reduce((s, b) => s + Number(b.total_price), 0);
    const confirmed = filtered.filter(b => b.status === 'confirmed').length;
    const cancelled = filtered.filter(b => b.status === 'cancelled').length;
    return {
      total: filtered.length,
      revenue,
      avg: Math.round(revenue / filtered.length),
      confirmed: Math.round((confirmed / filtered.length) * 100),
      cancelled: Math.round((cancelled / filtered.length) * 100),
    };
  }, [filtered]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/60"
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/90">Bookings Manager</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input 
            placeholder="Search bookings..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 bg-[#111111] border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] bg-[#111111] border-white/10 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1A1A] border-white/10">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={v => { setServiceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] bg-[#111111] border-white/10 text-white">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1A1A] border-white/10">
            <SelectItem value="all">All Services</SelectItem>
            <SelectItem value="luxury_transport">Luxury Transport</SelectItem>
            <SelectItem value="yacht">Yacht</SelectItem>
            <SelectItem value="chef">Chef</SelectItem>
            <SelectItem value="jet">Jet</SelectItem>
            <SelectItem value="event">Event</SelectItem>
          </SelectContent>
        </Select>
        <ExportButton
          data={(filtered || []) as Record<string, unknown>[]}
          filename="toptier-bookings"
          columns={[
            { key: 'id', label: 'Booking ID' },
            { key: 'client_name', label: 'Client' },
            { key: 'service_type', label: 'Service Type' },
            { key: 'service_name', label: 'Service' },
            { key: 'total_price', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Created' },
          ]}
        />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: metrics.total, icon: CalendarCheck },
          { label: 'Revenue', value: `$${metrics.revenue.toLocaleString()}`, icon: DollarSign },
          { label: 'Avg Value', value: `$${metrics.avg.toLocaleString()}`, icon: TrendingUp },
          { label: 'Confirmed', value: `${metrics.confirmed}%`, icon: CalendarCheck },
          { label: 'Cancelled', value: `${metrics.cancelled}%`, icon: XCircle },
        ].map((m, i) => (
          <Card key={i} className="bg-[#111111] border-[#C9A84C]/10">
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className="h-4 w-4 text-[#C9A84C]" />
              <div>
                <p className="text-lg font-bold text-white/90">{m.value}</p>
                <p className="text-[10px] text-white/40 uppercase">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-[#111111] border-[#C9A84C]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/5">
              <tr>
                <SortHeader col="id">Booking ID</SortHeader>
                <SortHeader col="client_name">Client</SortHeader>
                <SortHeader col="service_type">Service</SortHeader>
                <SortHeader col="scheduled_at">Date/Time</SortHeader>
                <SortHeader col="total_price">Amount</SortHeader>
                <SortHeader col="status">Status</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Partner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-8 bg-white/5" /></td></tr>
              )) : paged.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-white/30">No bookings found</td></tr>
              ) : paged.map(b => (
                <tr 
                  key={b.id} 
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setSelectedBooking(b)}
                >
                  <td className="px-4 py-3 text-xs font-mono text-white/50">{b.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-white/80">{b.client_name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] border-white/10 text-white/60">{b.service_type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {b.scheduled_at ? format(new Date(b.scheduled_at), 'MMM d, yyyy h:mm a') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#C9A84C]">${Number(b.total_price).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${STATUS_COLORS[b.status] || ''}`}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">{b.partner_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="text-xs text-white/40 hover:text-[#C9A84C]">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <p className="text-xs text-white/30">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Slide-over */}
      <Sheet open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
        <SheetContent className="bg-[#111111] border-l border-[#C9A84C]/10 text-white w-[480px] sm:max-w-[480px]">
          {selectedBooking && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[#C9A84C]">Booking Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="space-y-3">
                  <InfoRow label="Booking ID" value={selectedBooking.id} mono />
                  <InfoRow label="Client" value={selectedBooking.client_name} />
                  <InfoRow label="Email" value={selectedBooking.client_email || '—'} />
                  <InfoRow label="Phone" value={selectedBooking.client_phone || '—'} />
                  <InfoRow label="Service" value={`${selectedBooking.service_type} — ${selectedBooking.service_name}`} />
                  <InfoRow label="Amount" value={`$${Number(selectedBooking.total_price).toLocaleString()}`} gold />
                  <InfoRow label="Status" value={selectedBooking.status} />
                  <InfoRow label="Partner" value={selectedBooking.partner_name || 'Unassigned'} />
                  <InfoRow label="Scheduled" value={selectedBooking.scheduled_at ? format(new Date(selectedBooking.scheduled_at), 'PPp') : '—'} />
                  <InfoRow label="Created" value={formatDistanceToNow(new Date(selectedBooking.created_at), { addSuffix: true })} />
                </div>
                {selectedBooking.notes && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-white/70">{selectedBooking.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-4 border-t border-white/5">
                  <Button size="sm" className="bg-[#C9A84C] text-black hover:bg-[#B8973B]">Reassign Partner</Button>
                  <Button size="sm" variant="outline" className="border-white/10 text-white/60">Mark Complete</Button>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">Cancel</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoRow({ label, value, mono, gold }: { label: string; value: string; mono?: boolean; gold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono text-white/50 text-xs' : gold ? 'font-semibold text-[#C9A84C]' : 'text-white/80'}`}>{value}</span>
    </div>
  );
}
