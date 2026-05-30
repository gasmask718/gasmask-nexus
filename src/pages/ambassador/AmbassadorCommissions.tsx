/**
 * Ambassador Commissions Page
 * Real commission ledger, SQL-computed totals, zero client-side math
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, 
  Store, ShoppingCart, Users, Download, Search, Receipt
} from 'lucide-react';
import { useCommissionPage, type CommissionLedgerEntry, type SourceChannel } from '@/hooks/useCommissionLedger';
import { useEffectiveAmbassadorId } from '@/hooks/useAmbassadorComms';
import { format } from 'date-fns';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';

export default function AmbassadorCommissions() {
  const ambassadorId = useEffectiveAmbassadorId();
  const { ledger, totals, channels, payouts, isLoading } = useCommissionPage({ ambassadorId });
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'store_order': return <Store className="h-4 w-4" />;
      case 'wholesale_order': return <ShoppingCart className="h-4 w-4" />;
      case 'affiliate': return <TrendingUp className="h-4 w-4" />;
      case 'team_override': return <Users className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'store_order': return 'Store Order';
      case 'wholesale_order': return 'Wholesale';
      case 'affiliate': return 'Affiliate';
      case 'team_override': return 'Team Override';
      default: return channel;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'reversed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><AlertCircle className="h-3 w-3 mr-1" />Reversed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredEntries = ledger.filter((entry: CommissionLedgerEntry) => {
    const matchesSearch = entry.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          entry.source_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === 'all' || entry.source_channel === channelFilter;
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  if (isLoading) {
    return (
      <AmbassadorLayout 
        title="Commission Center" 
        subtitle="Track earnings, view ledger, and manage payouts"
        backPath="/ambassador/dashboard"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AmbassadorLayout>
    );
  }

  return (
    <AmbassadorLayout 
      title="Commission Center" 
      subtitle="Track earnings, view ledger, and manage payouts"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Summary Cards - Data from SQL view, zero client math */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card 
            className={`bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20 cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    ${Number(totals.pending_total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{totals.pending_count} entries</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20 cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'approved' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-blue-500">
                    ${Number(totals.approved_total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{totals.approved_count} entries</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'paid' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid (Lifetime)</p>
                  <p className="text-2xl font-bold text-green-500">
                    ${Number(totals.paid_total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{totals.paid_count} entries</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 cursor-pointer transition-all hover:scale-[1.02] ${statusFilter === 'all' ? 'ring-2 ring-purple-500' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lifetime Total</p>
                  <p className="text-2xl font-bold text-purple-500">
                    ${Number(totals.lifetime_total || 0).toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel Breakdown - Data from SQL view */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Earnings by Channel</CardTitle>
            <CardDescription>Commission breakdown by source type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer transition-all hover:bg-muted ${channelFilter === 'store_order' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setChannelFilter(channelFilter === 'store_order' ? 'all' : 'store_order')}
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Store Orders</p>
                  <p className="font-semibold">${Number(channels.store_order || 0).toFixed(2)}</p>
                </div>
              </div>
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer transition-all hover:bg-muted ${channelFilter === 'wholesale_order' ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setChannelFilter(channelFilter === 'wholesale_order' ? 'all' : 'wholesale_order')}
              >
                <div className="p-2 rounded-full bg-blue-500/10">
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wholesale</p>
                  <p className="font-semibold">${Number(channels.wholesale_order || 0).toFixed(2)}</p>
                </div>
              </div>
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer transition-all hover:bg-muted ${channelFilter === 'affiliate' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setChannelFilter(channelFilter === 'affiliate' ? 'all' : 'affiliate')}
              >
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Affiliate</p>
                  <p className="font-semibold">${Number(channels.affiliate || 0).toFixed(2)}</p>
                </div>
              </div>
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer transition-all hover:bg-muted ${channelFilter === 'team_override' ? 'ring-2 ring-purple-500' : ''}`}
                onClick={() => setChannelFilter(channelFilter === 'team_override' ? 'all' : 'team_override')}
              >
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team Override</p>
                  <p className="font-semibold">${Number(channels.team_override || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Ledger & Payouts */}
        <Tabs defaultValue="ledger" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ledger">Commission Ledger</TabsTrigger>
            <TabsTrigger value="payouts">Payout History</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by store or source ID..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="store_order">Store Orders</SelectItem>
                  <SelectItem value="wholesale_order">Wholesale</SelectItem>
                  <SelectItem value="affiliate">Affiliate</SelectItem>
                  <SelectItem value="team_override">Team Override</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                title="Export visible rows to CSV"
                disabled={filteredEntries.length === 0}
                onClick={() => {
                  const header = ['Date','Store/Source','Channel','Gross','Rate (%)','Commission','Status','Reversal Of'];
                  const escape = (v: any) => {
                    const s = v == null ? '' : String(v);
                    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                  };
                  const rows = filteredEntries.map((e: CommissionLedgerEntry) => [
                    e.earned_at ? format(new Date(e.earned_at), 'yyyy-MM-dd') : '',
                    e.store_name || e.source_id,
                    getChannelLabel(e.source_channel),
                    Number(e.gross_amount).toFixed(2),
                    e.commission_rate,
                    Number(e.commission_amount).toFixed(2),
                    e.status,
                    e.reversal_of || '',
                  ].map(escape).join(','));
                  const csv = [header.join(','), ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `commissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Ledger Table - Real data from commission_ledger */}
            <Card>
              <div className="max-h-[400px] w-full overflow-auto">
                <Table>

                  <TableHeader>
                    <TableRow>
                      <TableHead>Store / Source</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Earned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id} className={entry.reversal_of ? 'opacity-60' : ''}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {entry.store_name || entry.source_id.slice(0, 8)}
                          {entry.reversal_of && <span className="text-red-500 ml-1">(Reversal)</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(entry.source_channel)}
                            <span className="text-sm">{getChannelLabel(entry.source_channel)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          ${Number(entry.gross_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{entry.commission_rate}%</TableCell>
                        <TableCell className={`text-right font-semibold ${Number(entry.commission_amount) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {Number(entry.commission_amount) >= 0 ? '+' : ''}${Number(entry.commission_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(entry.earned_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {ledger.length === 0 
                            ? 'No commission entries yet. Start earning by completing store orders!'
                            : 'No entries match your filters'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Payout History
                </CardTitle>
                <CardDescription>
                  All completed payout batches and statements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                <Table>

                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          {format(new Date(payout.period_start), 'MMM d, yyyy')} - {format(new Date(payout.period_end), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-500">
                          ${Number(payout.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payout.paid_at ? format(new Date(payout.paid_at), 'MMM d, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {payouts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No payouts yet. Approved commissions will be batched for payment.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>

            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AmbassadorLayout>
  );
}
