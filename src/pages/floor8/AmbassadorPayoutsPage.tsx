/**
 * Floor 8 — Ambassador Payouts (Admin Ledger)
 * Financial trust layer - transparent, auditable payout system
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from '@/components/crud/ExportButton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  DollarSign, Users, Clock, CheckCircle2, AlertTriangle,
  Search, Filter, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AmbassadorPayoutsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Fetch all commissions from canonical ledger (commission_ledger)
  // Aliased: amount←commission_amount, category←source_channel
  const { data: commissionsRaw = [], isLoading } = useQuery({
    queryKey: ['floor8-payouts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_ledger')
        .select(`
          id, ambassador_id, commission_amount, gross_amount, status,
          source_channel, source_name, earned_at, paid_at, created_at,
          ambassador:ambassadors!commission_ledger_ambassador_id_fkey(id, name, tier, tracking_code)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const commissions = (commissionsRaw as any[]).map((c) => ({
    ...c,
    category: c.source_channel,
  }));

  // Mark commission as paid (writes back to canonical ledger)
  const markPaidMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('commission_ledger')
        .update({ status: 'paid', paid_at: now, approved_at: now })
        .eq('id', commissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor8-payouts-all'] });
      toast.success('Commission marked as paid');
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'unknown error'}`),
  });

  // Calculate summary metrics
  const pendingCommissions = commissions.filter(c => c.status === 'pending');
  const paidCommissions = commissions.filter(c => c.status === 'paid');
  
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
  const paid30d = paidCommissions
    .filter(c => new Date(c.paid_at || c.created_at) >= thirtyDaysAgo)
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
  const paid90d = paidCommissions
    .filter(c => new Date(c.paid_at || c.created_at) >= ninetyDaysAgo)
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

  // Get unique ambassadors with pending payouts
  const ambassadorsWithPending = [...new Set(pendingCommissions.map(c => c.ambassador_id))];

  // Filter commissions
  let filteredCommissions = commissions;
  
  if (searchTerm) {
    filteredCommissions = filteredCommissions.filter(c => 
      c.ambassador?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ambassador?.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  if (statusFilter !== 'all') {
    filteredCommissions = filteredCommissions.filter(c => c.status === statusFilter);
  }
  
  if (dateFilter === '7d') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filteredCommissions = filteredCommissions.filter(c => new Date(c.created_at) >= sevenDaysAgo);
  } else if (dateFilter === '30d') {
    filteredCommissions = filteredCommissions.filter(c => new Date(c.created_at) >= thirtyDaysAgo);
  } else if (dateFilter === '90d') {
    filteredCommissions = filteredCommissions.filter(c => new Date(c.created_at) >= ninetyDaysAgo);
  }

  // Group by ambassador for summary view
  const ambassadorSummary = commissions.reduce((acc: any, c) => {
    const ambId = c.ambassador_id;
    if (!acc[ambId]) {
      acc[ambId] = {
        ambassador: c.ambassador,
        pending: 0,
        paid: 0,
        total: 0,
        count: 0,
      };
    }
    acc[ambId].count++;
    acc[ambId].total += Number(c.commission_amount || 0);
    if (c.status === 'pending') acc[ambId].pending += Number(c.commission_amount || 0);
    if (c.status === 'paid') acc[ambId].paid += Number(c.commission_amount || 0);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              Ambassador Payouts
            </h1>
            <p className="text-muted-foreground mt-1">
              Commission tracking and payment management
            </p>
          </div>
          <ExportButton
            data={filteredCommissions.map(c => ({
              ambassador: c.ambassador?.name || 'Unknown',
              amount: c.commission_amount,
              status: c.status,
              date: c.created_at,
              type: c.category,
            }))}
            filename="ambassador-payouts"
            columns={[
              { key: 'ambassador', label: 'Ambassador' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
              { key: 'date', label: 'Date' },
              { key: 'type', label: 'Type' },
            ]}
          />
        </div>

        {/* Summary KPIs */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-muted-foreground">Total Pending</span>
              </div>
              <div className="text-3xl font-bold text-amber-500 mt-2">
                ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ambassadorsWithPending.length} ambassadors awaiting payment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Paid (30d)</span>
              </div>
              <div className="text-3xl font-bold text-green-500 mt-2">
                ${paid30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Paid (90d)</span>
              </div>
              <div className="text-3xl font-bold text-green-500 mt-2">
                ${paid90d.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Active Ambassadors</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {Object.keys(ambassadorSummary).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ambassadors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredCommissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No commissions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambassador</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
              {filteredCommissions.slice(0, 100).map((comm) => (
                    <TableRow key={comm.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{comm.ambassador?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{comm.ambassador?.tracking_code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{comm.category || 'order'}</Badge>
                      </TableCell>
                      <TableCell>${Number(comm.gross_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="font-bold">
                        ${Number(comm.commission_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(comm.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            comm.status === 'paid' ? 'default' : 
                            comm.status === 'pending' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {comm.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {comm.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markPaidMutation.mutate(comm.id)}
                            disabled={markPaidMutation.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
