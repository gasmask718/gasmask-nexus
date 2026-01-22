/**
 * Ambassador Commissions Page
 * Comprehensive commission ledger, earnings breakdown, and payout history
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
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, 
  Store, ShoppingCart, Users, Download, Filter, Search,
  Calendar, ArrowUpRight, ArrowDownRight, Receipt
} from 'lucide-react';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { format } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';

interface CommissionEntry {
  id: string;
  source_channel: 'store_order' | 'wholesale_order' | 'merch_affiliate' | 'team_override';
  source_id: string;
  source_name: string;
  gross_amount: number;
  commission_amount: number;
  rate: number;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  created_at: string;
  notes?: string;
}

interface PayoutBatch {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: 'draft' | 'approved' | 'paid';
  paid_at?: string;
  items_count: number;
}

export default function AmbassadorCommissions() {
  const { metrics, isLoading } = useAmbassadorPortfolio();
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Mock commission data - will be replaced with real data from commission_ledger
  const commissionEntries: CommissionEntry[] = [
    {
      id: '1',
      source_channel: 'store_order',
      source_id: 'ord-001',
      source_name: 'Quick Stop Deli - Order #1234',
      gross_amount: 450.00,
      commission_amount: 22.50,
      rate: 5,
      status: 'paid',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      source_channel: 'wholesale_order',
      source_id: 'wh-001',
      source_name: 'NYC Wholesale Supply - Order #5678',
      gross_amount: 2500.00,
      commission_amount: 75.00,
      rate: 3,
      status: 'approved',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      source_channel: 'merch_affiliate',
      source_id: 'aff-001',
      source_name: 'Online Store - Merch Sale',
      gross_amount: 89.99,
      commission_amount: 8.99,
      rate: 10,
      status: 'pending',
      created_at: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  const payoutHistory: PayoutBatch[] = [
    {
      id: 'pay-001',
      period_start: '2024-01-01',
      period_end: '2024-01-15',
      total_amount: 456.78,
      status: 'paid',
      paid_at: '2024-01-20',
      items_count: 12,
    },
    {
      id: 'pay-002',
      period_start: '2024-01-16',
      period_end: '2024-01-31',
      total_amount: 623.45,
      status: 'paid',
      paid_at: '2024-02-05',
      items_count: 18,
    },
  ];

  // Calculate totals from mock data
  const totalPending = commissionEntries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.commission_amount, 0);
  const totalApproved = commissionEntries
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + e.commission_amount, 0);
  const totalPaid = commissionEntries
    .filter(e => e.status === 'paid')
    .reduce((sum, e) => sum + e.commission_amount, 0);

  // Channel breakdown
  const channelBreakdown = {
    store_order: commissionEntries
      .filter(e => e.source_channel === 'store_order')
      .reduce((sum, e) => sum + e.commission_amount, 0),
    wholesale_order: commissionEntries
      .filter(e => e.source_channel === 'wholesale_order')
      .reduce((sum, e) => sum + e.commission_amount, 0),
    merch_affiliate: commissionEntries
      .filter(e => e.source_channel === 'merch_affiliate')
      .reduce((sum, e) => sum + e.commission_amount, 0),
    team_override: commissionEntries
      .filter(e => e.source_channel === 'team_override')
      .reduce((sum, e) => sum + e.commission_amount, 0),
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'store_order': return <Store className="h-4 w-4" />;
      case 'wholesale_order': return <ShoppingCart className="h-4 w-4" />;
      case 'merch_affiliate': return <TrendingUp className="h-4 w-4" />;
      case 'team_override': return <Users className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'store_order': return 'Store Order';
      case 'wholesale_order': return 'Wholesale';
      case 'merch_affiliate': return 'Affiliate';
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

  const filteredEntries = commissionEntries.filter(entry => {
    const matchesSearch = entry.source_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === 'all' || entry.source_channel === channelFilter;
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  return (
    <EnhancedPortalLayout 
      title="Commission Center" 
      subtitle="Track earnings, view ledger, and manage payouts"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">${totalPending.toFixed(2)}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-blue-500">${totalApproved.toFixed(2)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid (Lifetime)</p>
                  <p className="text-2xl font-bold text-green-500">${totalPaid.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold text-purple-500">
                    ${(totalPending + totalApproved).toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Earnings by Channel</CardTitle>
            <CardDescription>Commission breakdown by source type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-primary/10">
                  <Store className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Store Orders</p>
                  <p className="font-semibold">${channelBreakdown.store_order.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <ShoppingCart className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wholesale</p>
                  <p className="font-semibold">${channelBreakdown.wholesale_order.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Affiliate</p>
                  <p className="font-semibold">${channelBreakdown.merch_affiliate.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team Override</p>
                  <p className="font-semibold">${channelBreakdown.team_override.toFixed(2)}</p>
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
                  placeholder="Search transactions..." 
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
                  <SelectItem value="merch_affiliate">Affiliate</SelectItem>
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
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Ledger Table */}
            <Card>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {entry.source_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(entry.source_channel)}
                            <span className="text-sm">{getChannelLabel(entry.source_channel)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${entry.gross_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{entry.rate}%</TableCell>
                        <TableCell className="text-right font-semibold text-green-500">
                          +${entry.commission_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No commission entries found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutHistory.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="font-medium">
                          {format(new Date(payout.period_start), 'MMM d')} - {format(new Date(payout.period_end), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-500">
                          ${payout.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{payout.items_count}</TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {payout.paid_at ? format(new Date(payout.paid_at), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Statement
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {payoutHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No payout history yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dispute CTA */}
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Commission Dispute?</p>
                <p className="text-sm text-muted-foreground">
                  If you believe there's an error in your commissions, submit a dispute for review.
                </p>
              </div>
              <Button variant="outline">
                <AlertCircle className="h-4 w-4 mr-2" />
                File Dispute
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </EnhancedPortalLayout>
  );
}
