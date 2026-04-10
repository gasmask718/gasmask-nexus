import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { Search, Store } from 'lucide-react';

interface DemoVendor {
  id: string;
  name: string;
  type: string;
  city: string;
  state: string;
  rating: number;
  bookings: number;
  revenue: number;
  status: string;
}

const DEMO_VENDORS: DemoVendor[] = [
  { id: '1', name: 'The Grand Ballroom', type: 'Venue', city: 'Houston', state: 'TX', rating: 4.8, bookings: 42, revenue: 68500, status: 'Active' },
  { id: '2', name: 'Elite Event Staff', type: 'Staff', city: 'Dallas', state: 'TX', rating: 4.6, bookings: 31, revenue: 24800, status: 'Active' },
  { id: '3', name: 'Party Props Unlimited', type: 'Rental', city: 'Atlanta', state: 'GA', rating: 4.3, bookings: 18, revenue: 12200, status: 'Pending' },
];

const TYPE_COLORS: Record<string, string> = {
  Venue: 'bg-blue-500/20 text-blue-400',
  Staff: 'bg-green-500/20 text-green-400',
  Rental: 'bg-orange-500/20 text-orange-400',
  Entertainment: 'bg-purple-500/20 text-purple-400',
  Catering: 'bg-red-500/20 text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-500/20 text-green-400',
  Pending: 'bg-yellow-500/20 text-yellow-400',
  Suspended: 'bg-red-500/20 text-red-400',
};

export default function UFTVendors() {
  const [search, setSearch] = useState('');

  const filtered = DEMO_VENDORS.filter(
    (v) => v.name.toLowerCase().includes(search.toLowerCase()) || v.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Store className="h-7 w-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Vendor Management</h1>
          <p className="text-sm text-muted-foreground">Unforgettable Times vendor directory</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Vendors</span>
            <span className="text-xs text-muted-foreground font-normal">
              Live vendor data pulls from UFT API. Full table requires get-vendors-list edge function.
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[v.type] || ''}`}>{v.type}</span>
                  </TableCell>
                  <TableCell>{v.city}, {v.state}</TableCell>
                  <TableCell className="text-right">⭐ {v.rating}</TableCell>
                  <TableCell className="text-right">{v.bookings}</TableCell>
                  <TableCell className="text-right">{formatCurrency(v.revenue)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[v.status] || ''}`}>{v.status}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
