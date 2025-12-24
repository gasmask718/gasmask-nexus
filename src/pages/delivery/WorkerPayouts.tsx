import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  DollarSign, Search, Filter, Plus, CheckCircle2, Clock, 
  FileText, Download, CreditCard, User, Truck, Bike
} from 'lucide-react';

type WorkerPayout = {
  id: string;
  business_id: string;
  worker_type: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  total_earned: number;
  adjustments: number;
  debt_withheld: number;
  total_to_pay: number;
  status: string;
  payout_method: string | null;
  payout_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

const WorkerPayouts: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workerTypeFilter, setWorkerTypeFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<WorkerPayout | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [payoutReference, setPayoutReference] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('zelle');

  // Fetch payouts
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['worker-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_payouts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkerPayout[];
    }
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('id, full_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch bikers
  const { data: bikers = [] } = useQuery({
    queryKey: ['bikers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bikers').select('id, full_name');
      if (error) throw error;
      return data;
    }
  });

  // Update payout status
  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status, method, reference }: { id: string; status: string; method?: string; reference?: string }) => {
      const updates: any = { status };
      if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
        if (method) updates.payout_method = method;
        if (reference) updates.payout_reference = reference;
      }
      const { error } = await supabase.from('worker_payouts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payouts'] });
      toast.success('Payout updated');
      setSelectedPayout(null);
    },
    onError: () => toast.error('Failed to update payout')
  });

  // Create payout
  const createPayoutMutation = useMutation({
    mutationFn: async (data: Partial<WorkerPayout>) => {
      const { error } = await supabase.from('worker_payouts').insert({
        ...data,
        status: 'draft'
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worker-payouts'] });
      toast.success('Payout created');
      setShowCreateDialog(false);
    },
    onError: () => toast.error('Failed to create payout')
  });

  const getWorkerName = (payout: WorkerPayout) => {
    if (payout.worker_type === 'driver') {
      return drivers.find(d => d.id === payout.worker_id)?.full_name || 'Unknown Driver';
    }
    return bikers.find(b => b.id === payout.worker_id)?.full_name || 'Unknown Biker';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      pending_approval: 'secondary',
      approved: 'default',
      paid: 'default',
      void: 'destructive'
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
  };

  const filteredPayouts = payouts.filter(payout => {
    const workerName = getWorkerName(payout).toLowerCase();
    const matchesSearch = workerName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payout.status === statusFilter;
    const matchesType = workerTypeFilter === 'all' || payout.worker_type === workerTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPending = payouts.filter(p => p.status === 'pending_approval').reduce((sum, p) => sum + p.total_to_pay, 0);
  const totalApproved = payouts.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.total_to_pay, 0);
  const totalPaid = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.total_to_pay, 0);

  const exportCSV = () => {
    const headers = ['Worker', 'Type', 'Period', 'Earned', 'Adjustments', 'Debt', 'Total', 'Status'];
    const rows = filteredPayouts.map(p => [
      getWorkerName(p),
      p.worker_type,
      `${p.period_start} - ${p.period_end}`,
      p.total_earned,
      p.adjustments,
      p.debt_withheld,
      p.total_to_pay,
      p.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Worker Payouts
            </h1>
            <p className="text-muted-foreground">Manage driver and biker payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Generate Payout</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Payout</DialogTitle>
                </DialogHeader>
                <CreatePayoutForm 
                  drivers={drivers}
                  bikers={bikers}
                  onSubmit={(data) => createPayoutMutation.mutate(data)}
                  isLoading={createPayoutMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">${totalApproved.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Approved (Unpaid)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Total Paid (All Time)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{payouts.length}</div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by worker name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={workerTypeFilter} onValueChange={setWorkerTypeFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Worker Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workers</SelectItem>
              <SelectItem value="driver">Drivers</SelectItem>
              <SelectItem value="biker">Bikers</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No payouts found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Worker</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-left py-3 px-2">Period</th>
                      <th className="text-right py-3 px-2">Earned</th>
                      <th className="text-right py-3 px-2">Debt</th>
                      <th className="text-right py-3 px-2">Total</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-right py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayouts.map(payout => (
                      <tr key={payout.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {payout.worker_type === 'driver' ? 
                              <Truck className="h-4 w-4 text-muted-foreground" /> : 
                              <Bike className="h-4 w-4 text-muted-foreground" />
                            }
                            {getWorkerName(payout)}
                          </div>
                        </td>
                        <td className="py-3 px-2 capitalize">{payout.worker_type}</td>
                        <td className="py-3 px-2 text-sm">
                          {payout.period_start} - {payout.period_end}
                        </td>
                        <td className="py-3 px-2 text-right">${payout.total_earned.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-red-600">
                          {payout.debt_withheld > 0 ? `-$${payout.debt_withheld.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 px-2 text-right font-medium">${payout.total_to_pay.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">{getStatusBadge(payout.status)}</td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-2">
                            {payout.status === 'draft' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => updatePayoutMutation.mutate({ id: payout.id, status: 'pending_approval' })}
                              >
                                Submit
                              </Button>
                            )}
                            {payout.status === 'pending_approval' && (
                              <Button 
                                size="sm"
                                onClick={() => updatePayoutMutation.mutate({ id: payout.id, status: 'approved' })}
                              >
                                Approve
                              </Button>
                            )}
                            {payout.status === 'approved' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" onClick={() => setSelectedPayout(payout)}>
                                    <CreditCard className="h-4 w-4 mr-1" /> Pay
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Mark as Paid</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 mt-4">
                                    <div>
                                      <label className="text-sm font-medium">Worker</label>
                                      <p className="text-muted-foreground">{getWorkerName(payout)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Amount</label>
                                      <p className="text-2xl font-bold">${payout.total_to_pay.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Payment Method</label>
                                      <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="cash">Cash</SelectItem>
                                          <SelectItem value="zelle">Zelle</SelectItem>
                                          <SelectItem value="ach">ACH</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Reference / Confirmation</label>
                                      <Input 
                                        value={payoutReference}
                                        onChange={(e) => setPayoutReference(e.target.value)}
                                        placeholder="Enter confirmation number..."
                                      />
                                    </div>
                                    <Button 
                                      className="w-full"
                                      onClick={() => {
                                        updatePayoutMutation.mutate({ 
                                          id: payout.id, 
                                          status: 'paid',
                                          method: payoutMethod,
                                          reference: payoutReference
                                        });
                                        setPayoutReference('');
                                      }}
                                    >
                                      Confirm Payment
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

// Create Payout Form
const CreatePayoutForm: React.FC<{
  drivers: any[];
  bikers: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ drivers, bikers, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    worker_type: 'driver',
    worker_id: '',
    period_start: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    period_end: format(new Date(), 'yyyy-MM-dd'),
    total_earned: 0,
    adjustments: 0,
    debt_withheld: 0
  });

  const workers = formData.worker_type === 'driver' ? drivers : bikers;
  const totalToPay = formData.total_earned + formData.adjustments - formData.debt_withheld;

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium">Worker Type</label>
        <Select value={formData.worker_type} onValueChange={(v) => setFormData(prev => ({ ...prev, worker_type: v, worker_id: '' }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="driver">Driver</SelectItem>
            <SelectItem value="biker">Biker</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Worker</label>
        <Select value={formData.worker_id} onValueChange={(v) => setFormData(prev => ({ ...prev, worker_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select worker" />
          </SelectTrigger>
          <SelectContent>
            {workers.map(w => (
              <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Period Start</label>
          <Input 
            type="date" 
            value={formData.period_start}
            onChange={(e) => setFormData(prev => ({ ...prev, period_start: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Period End</label>
          <Input 
            type="date" 
            value={formData.period_end}
            onChange={(e) => setFormData(prev => ({ ...prev, period_end: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Total Earned ($)</label>
        <Input 
          type="number"
          step="0.01"
          value={formData.total_earned}
          onChange={(e) => setFormData(prev => ({ ...prev, total_earned: parseFloat(e.target.value) || 0 }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Adjustments ($)</label>
          <Input 
            type="number"
            step="0.01"
            value={formData.adjustments}
            onChange={(e) => setFormData(prev => ({ ...prev, adjustments: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Debt Withheld ($)</label>
          <Input 
            type="number"
            step="0.01"
            value={formData.debt_withheld}
            onChange={(e) => setFormData(prev => ({ ...prev, debt_withheld: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total to Pay:</span>
          <span className="text-2xl font-bold">${totalToPay.toFixed(2)}</span>
        </div>
      </div>
      <Button 
        className="w-full" 
        onClick={() => onSubmit({ ...formData, total_to_pay: totalToPay })}
        disabled={!formData.worker_id || isLoading}
      >
        {isLoading ? 'Creating...' : 'Create Payout'}
      </Button>
    </div>
  );
};

export default WorkerPayouts;
