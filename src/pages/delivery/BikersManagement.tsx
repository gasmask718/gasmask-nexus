import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Bike, Search, Filter, Plus, Edit, Phone, Mail, 
  MapPin, CheckCircle2, XCircle, Download, User, Eye,
  TrendingUp, AlertCircle, Map as MapIcon, Route
} from 'lucide-react';
import IssuesBoard from '@/components/biker/IssuesBoard';
import { useAllBikersPerformance } from '@/hooks/useBikerPerformance';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationModeToggle, SimulationBanner } from '@/components/delivery/SimulationModeToggle';

type Biker = {
  id: string;
  business_id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  territory: string | null;
  status: string;
  payout_method: string | null;
  payout_handle: string | null;
  created_at: string;
};

const BikersManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { simulationMode, simulationData } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBiker, setEditingBiker] = useState<Biker | null>(null);

  const { data: dbBikers = [], isLoading } = useQuery({
    queryKey: ['bikers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bikers')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Biker[];
    }
  });

  // Generate simulated bikers from simulation data
  const simBikers = useMemo(() => {
    if (!simulationMode || dbBikers.length > 0) return [];
    return simulationData.bikers.map(b => ({
      id: b.id,
      business_id: 'sim-business',
      user_id: null,
      full_name: b.full_name,
      phone: b.phone,
      email: b.email,
      territory: b.territory,
      status: b.status === 'offline' ? 'paused' : 'active',
      payout_method: 'zelle',
      payout_handle: b.email,
      created_at: new Date().toISOString(),
      is_simulated: true,
    })) as (Biker & { is_simulated?: boolean })[];
  }, [simulationMode, simulationData, dbBikers.length]);

  // Resolve data
  const bikers = dbBikers.length > 0 ? dbBikers : simBikers;
  const isSimulated = dbBikers.length === 0 && simBikers.length > 0;

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Biker>) => {
      const { error } = await supabase.from('bikers').insert({ ...data, status: 'active' } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bikers'] });
      toast.success('Biker created');
      setShowCreateDialog(false);
    },
    onError: () => toast.error('Failed to create biker')
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Biker> }) => {
      const { error } = await supabase.from('bikers').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bikers'] });
      toast.success('Biker updated');
      setEditingBiker(null);
    },
    onError: () => toast.error('Failed to update biker')
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'active' ? 'paused' : 'active';
      const { error } = await supabase.from('bikers').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bikers'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status')
  });

  const filteredBikers = bikers.filter(biker => {
    const matchesSearch = 
      biker.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      biker.phone.includes(searchTerm) ||
      biker.territory?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || biker.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = bikers.filter(b => b.status === 'active').length;
  const pausedCount = bikers.filter(b => b.status === 'paused').length;

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Territory', 'Status', 'Payout Method'];
    const rows = filteredBikers.map(b => [
      b.full_name,
      b.phone,
      b.email || '',
      b.territory || '',
      b.status,
      b.payout_method || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bikers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Fetch today's performance for all bikers
  const { data: todayPerformance = [] } = useAllBikersPerformance();

  // Create a map of biker id to performance
  const performanceMap = React.useMemo(() => {
    const map = new Map<string, any>();
    todayPerformance.forEach((p: any) => {
      if (p.biker_id) map.set(p.biker_id, p);
    });
    return map;
  }, [todayPerformance]);

  return (
    <Layout>
      <SimulationBanner />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              Bikers Management
              {isSimulated && <SimulationBadge className="ml-2" />}
            </h1>
            <p className="text-muted-foreground">Manage store checker bikers</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SimulationModeToggle />
            <Button variant="outline" onClick={() => navigate('/delivery/heatmap')}>
              <MapIcon className="h-4 w-4 mr-2" /> Heatmap
            </Button>
            <Button variant="outline" onClick={() => navigate('/delivery/route-suggestions')}>
              <Route className="h-4 w-4 mr-2" /> Route Suggestions
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Biker</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Biker</DialogTitle>
                </DialogHeader>
                <BikerForm 
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
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
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{bikers.length}</div>
                  <p className="text-sm text-muted-foreground">Total Bikers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">{activeCount}</div>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{pausedCount}</div>
                  <p className="text-sm text-muted-foreground">Paused</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {todayPerformance.length > 0 
                      ? Math.round(todayPerformance.reduce((s: number, p: any) => s + (p.score || 0), 0) / todayPerformance.length)
                      : '--'}
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Bikers / Issues */}
        <Tabs defaultValue="bikers">
          <TabsList>
            <TabsTrigger value="bikers">
              <Bike className="h-4 w-4 mr-2" /> Bikers
            </TabsTrigger>
            <TabsTrigger value="issues">
              <AlertCircle className="h-4 w-4 mr-2" /> Issues Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bikers" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or territory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="offboarded">Offboarded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bikers Grid */}
            {isLoading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : filteredBikers.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No bikers found</CardContent></Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBikers.map(biker => {
                  const perf = performanceMap.get(biker.id);
                  return (
                    <Card key={biker.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Bike className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{biker.full_name}</CardTitle>
                              {biker.territory && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {biker.territory}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={biker.status === 'active' ? 'default' : 'secondary'}>
                              {biker.status}
                            </Badge>
                            {perf && (
                              <Badge variant="outline" className={
                                perf.score >= 80 ? 'border-green-500 text-green-600' :
                                perf.score >= 60 ? 'border-yellow-500 text-yellow-600' :
                                'border-destructive text-destructive'
                              }>
                                Score: {Math.round(perf.score)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1 text-sm">
                          <a href={`tel:${biker.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                            <Phone className="h-4 w-4" /> {biker.phone}
                          </a>
                          {biker.email && (
                            <a href={`mailto:${biker.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                              <Mail className="h-4 w-4" /> {biker.email}
                            </a>
                          )}
                        </div>
                        
                        {/* Performance stats */}
                        {perf && (
                          <div className="grid grid-cols-3 gap-2 text-xs text-center">
                            <div className="p-1 bg-muted rounded">
                              <div className="font-semibold">{perf.tasks_approved || 0}</div>
                              <div className="text-muted-foreground">Approved</div>
                            </div>
                            <div className="p-1 bg-muted rounded">
                              <div className="font-semibold">{perf.tasks_rejected || 0}</div>
                              <div className="text-muted-foreground">Rejected</div>
                            </div>
                            <div className="p-1 bg-muted rounded">
                              <div className="font-semibold">{perf.issues_reported || 0}</div>
                              <div className="text-muted-foreground">Issues</div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate(`/delivery/bikers/${biker.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setEditingBiker(biker)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Biker</DialogTitle>
                              </DialogHeader>
                              <BikerForm 
                                initialData={biker}
                                onSubmit={(data) => updateMutation.mutate({ id: biker.id, data })}
                                isLoading={updateMutation.isPending}
                              />
                            </DialogContent>
                          </Dialog>
                          <Button 
                            size="sm" 
                            variant={biker.status === 'active' ? 'secondary' : 'default'}
                            onClick={() => toggleStatusMutation.mutate({ id: biker.id, status: biker.status })}
                          >
                            {biker.status === 'active' ? 'Pause' : 'Activate'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="issues" className="mt-4">
            <IssuesBoard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

// Biker Form Component
const BikerForm: React.FC<{
  initialData?: Partial<Biker>;
  onSubmit: (data: Partial<Biker>) => void;
  isLoading: boolean;
}> = ({ initialData, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    territory: initialData?.territory || '',
    payout_method: initialData?.payout_method || 'zelle',
    payout_handle: initialData?.payout_handle || ''
  });

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium">Full Name</label>
        <Input 
          value={formData.full_name}
          onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
          placeholder="Enter full name"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <Input 
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="Enter phone number"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Email (Optional)</label>
        <Input 
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="Enter email"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Territory</label>
        <Input 
          value={formData.territory}
          onChange={(e) => setFormData(prev => ({ ...prev, territory: e.target.value }))}
          placeholder="e.g., Brooklyn, Manhattan"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Payout Method</label>
          <Select value={formData.payout_method} onValueChange={(v) => setFormData(prev => ({ ...prev, payout_method: v }))}>
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
          <label className="text-sm font-medium">Payout Handle</label>
          <Input 
            value={formData.payout_handle}
            onChange={(e) => setFormData(prev => ({ ...prev, payout_handle: e.target.value }))}
            placeholder="Phone or email"
          />
        </div>
      </div>
      <Button 
        className="w-full" 
        onClick={() => onSubmit(formData)}
        disabled={!formData.full_name || !formData.phone || isLoading}
      >
        {isLoading ? 'Saving...' : initialData ? 'Update Biker' : 'Create Biker'}
      </Button>
    </div>
  );
};

export default BikersManagement;
