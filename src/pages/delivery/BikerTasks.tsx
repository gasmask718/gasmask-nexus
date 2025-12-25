import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ClipboardCheck, MapPin, Camera, Play, Send, CheckCircle2, 
  XCircle, Clock, Search, Filter, Plus, Eye
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { SimulationModeToggle, SimulationBanner } from '@/components/delivery/SimulationModeToggle';

type StoreCheck = {
  id: string;
  business_id: string;
  assigned_biker_id: string | null;
  location_id: string | null;
  check_type: string;
  scheduled_date: string;
  status: string;
  summary_notes: string | null;
  created_at: string;
};

const CHECK_TYPES = [
  'inventory_check',
  'sticker_check', 
  'relationship_visit',
  'compliance_check',
  'competitor_check',
  'other'
];

const BikerTasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { simulationMode, simulationData } = useSimulationMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCheck, setSelectedCheck] = useState<StoreCheck | null>(null);
  const [checkNotes, setCheckNotes] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch store checks
  const { data: dbStoreChecks = [], isLoading } = useQuery({
    queryKey: ['store-checks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_checks')
        .select('*')
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as StoreCheck[];
    }
  });

  // Generate simulated store checks from simulation data
  const simStoreChecks = useMemo(() => {
    if (!simulationMode || dbStoreChecks.length > 0) return [];
    return simulationData.bikers.flatMap((biker, bikerIdx) => 
      Array.from({ length: biker.tasks_pending + biker.tasks_completed }, (_, i) => ({
        id: `sim-check-${biker.id}-${i}`,
        business_id: 'sim-business',
        assigned_biker_id: biker.id,
        location_id: `sim-store-00${(i % 8) + 1}`,
        check_type: CHECK_TYPES[i % CHECK_TYPES.length],
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        status: i < biker.tasks_completed ? 'approved' : i === biker.tasks_completed ? 'in_progress' : 'assigned',
        summary_notes: i < biker.tasks_completed ? 'Completed check - all items verified' : null,
        created_at: new Date().toISOString(),
        is_simulated: true,
      }))
    ).slice(0, 12);
  }, [simulationMode, simulationData, dbStoreChecks.length]);

  // Resolve data: real data takes priority, then simulation data
  const storeChecks = dbStoreChecks.length > 0 ? dbStoreChecks : simStoreChecks;
  const isSimulated = dbStoreChecks.length === 0 && simStoreChecks.length > 0;

  // Fetch locations for display
  const { data: locations = [] } = useQuery({
    queryKey: ['delivery-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address_line1, city');
      if (error) throw error;
      return data;
    }
  });

  // Fetch bikers for assignment
  const { data: bikers = [] } = useQuery({
    queryKey: ['bikers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bikers')
        .select('id, full_name')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    }
  });

  // Update check status
  const updateCheckMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updates: any = { status };
      if (notes) updates.summary_notes = notes;
      if (status === 'approved' || status === 'rejected') {
        updates.reviewed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('store_checks').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-checks'] });
      toast.success('Check updated');
      setSelectedCheck(null);
    },
    onError: () => toast.error('Failed to update check')
  });

  // Create new store check
  const createCheckMutation = useMutation({
    mutationFn: async (data: { location_id: string; check_type: string; scheduled_date: string; assigned_biker_id?: string }) => {
      const { error } = await supabase.from('store_checks').insert({
        ...data,
        status: 'assigned'
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-checks'] });
      toast.success('Store check created');
      setShowCreateDialog(false);
    },
    onError: () => toast.error('Failed to create check')
  });

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return 'Unknown';
    // Check simulation stores first
    if (locationId.startsWith('sim-store-')) {
      const storeIdx = parseInt(locationId.replace('sim-store-00', '')) - 1;
      const simStores = [
        { name: 'Lucky Corner Store', address: '123 Main St' },
        { name: 'Golden Mini Mart', address: '456 Oak Ave' },
        { name: 'Quick Express Bodega', address: '789 Park Blvd' },
        { name: 'Family Grocery', address: '321 Broadway' },
        { name: 'Metro Supermarket', address: '654 Market St' },
        { name: 'City Crown Mart', address: '987 Liberty Ave' },
        { name: 'Star Convenience', address: '147 Center St' },
        { name: 'Royal Foods', address: '258 Washington Blvd' },
      ];
      const store = simStores[storeIdx];
      return store ? `${store.name} - ${store.address}` : 'Unknown Store';
    }
    const loc = locations.find(l => l.id === locationId);
    return loc ? `${loc.name} - ${loc.address_line1}` : 'Unknown';
  };

  const getBikerName = (bikerId: string | null) => {
    if (!bikerId) return 'Unassigned';
    // Check simulation bikers first
    if (bikerId.startsWith('sim-biker-')) {
      const simBiker = simulationData.bikers.find(b => b.id === bikerId);
      return simBiker?.full_name || 'Unknown Biker';
    }
    const biker = bikers.find(b => b.id === bikerId);
    return biker?.full_name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      assigned: { variant: 'outline', icon: <Clock className="h-3 w-3" /> },
      in_progress: { variant: 'default', icon: <Play className="h-3 w-3" /> },
      submitted: { variant: 'secondary', icon: <Send className="h-3 w-3" /> },
      approved: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { variant: 'destructive', icon: <XCircle className="h-3 w-3" /> }
    };
    const config = variants[status] || variants.assigned;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const filteredChecks = storeChecks.filter(check => {
    const matchesSearch = getLocationName(check.location_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.check_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || check.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const todayCount = storeChecks.filter(c => c.scheduled_date === format(new Date(), 'yyyy-MM-dd')).length;
  const pendingCount = storeChecks.filter(c => ['assigned', 'in_progress'].includes(c.status)).length;
  const submittedCount = storeChecks.filter(c => c.status === 'submitted').length;

  return (
    <Layout>
      <SimulationBanner />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6 text-primary" />
                Biker Store Checks
                {isSimulated && <SimulationBadge className="ml-2" />}
              </h1>
              <p className="text-muted-foreground">Manage store check tasks for bikers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SimulationModeToggle />
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> New Check</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Store Check</DialogTitle>
                </DialogHeader>
                <CreateCheckForm 
                  locations={locations}
                  bikers={bikers as any}
                  onSubmit={(data) => createCheckMutation.mutate(data)}
                  isLoading={createCheckMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{todayCount}</div>
              <p className="text-sm text-muted-foreground">Today's Checks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{submittedCount}</div>
              <p className="text-sm text-muted-foreground">Awaiting Review</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {storeChecks.filter(c => c.status === 'approved').length}
              </div>
              <p className="text-sm text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by location or type..."
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
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Checks List */}
        <div className="space-y-3">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filteredChecks.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No store checks found</CardContent></Card>
          ) : (
            filteredChecks.map(check => (
              <Card key={check.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{getLocationName(check.location_id)}</span>
                        {getStatusBadge(check.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>Type: {check.check_type.replace('_', ' ')}</span>
                        <span>Date: {check.scheduled_date}</span>
                        <span>Biker: {getBikerName(check.assigned_biker_id)}</span>
                      </div>
                      {check.summary_notes && (
                        <p className="text-sm bg-muted p-2 rounded">{check.summary_notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {check.status === 'assigned' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateCheckMutation.mutate({ id: check.id, status: 'in_progress' })}
                        >
                          <Play className="h-4 w-4 mr-1" /> Start
                        </Button>
                      )}
                      {check.status === 'in_progress' && (
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="sm" onClick={() => setSelectedCheck(check)}>
                              <Send className="h-4 w-4 mr-1" /> Submit
                            </Button>
                          </SheetTrigger>
                          <SheetContent>
                            <SheetHeader>
                              <SheetTitle>Submit Check</SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 space-y-4">
                              <div>
                                <label className="text-sm font-medium">Location</label>
                                <p className="text-muted-foreground">{getLocationName(check.location_id)}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Check Type</label>
                                <p className="text-muted-foreground">{check.check_type.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Notes / Findings</label>
                                <Textarea
                                  value={checkNotes}
                                  onChange={(e) => setCheckNotes(e.target.value)}
                                  placeholder="Enter your findings..."
                                  rows={4}
                                />
                              </div>
                              <Button 
                                className="w-full"
                                onClick={() => {
                                  updateCheckMutation.mutate({ id: check.id, status: 'submitted', notes: checkNotes });
                                  setCheckNotes('');
                                }}
                              >
                                <Camera className="h-4 w-4 mr-2" /> Submit Check
                              </Button>
                            </div>
                          </SheetContent>
                        </Sheet>
                      )}
                      {check.status === 'submitted' && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateCheckMutation.mutate({ id: check.id, status: 'approved' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => updateCheckMutation.mutate({ id: check.id, status: 'rejected' })}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

// Create Check Form Component
const CreateCheckForm: React.FC<{
  locations: any[];
  bikers: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ locations, bikers, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    location_id: '',
    check_type: 'inventory_check',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    assigned_biker_id: ''
  });

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium">Location</label>
        <Select value={formData.location_id} onValueChange={(v) => setFormData(prev => ({ ...prev, location_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name} - {loc.address_line1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Check Type</label>
        <Select value={formData.check_type} onValueChange={(v) => setFormData(prev => ({ ...prev, check_type: v }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHECK_TYPES.map(type => (
              <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Scheduled Date</label>
        <Input 
          type="date" 
          value={formData.scheduled_date}
          onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Assign Biker (Optional)</label>
        <Select value={formData.assigned_biker_id} onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_biker_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select biker" />
          </SelectTrigger>
          <SelectContent>
            {bikers.map(biker => (
              <SelectItem key={biker.id} value={biker.id}>{biker.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button 
        className="w-full" 
        onClick={() => onSubmit(formData)}
        disabled={!formData.location_id || isLoading}
      >
        {isLoading ? 'Creating...' : 'Create Check'}
      </Button>
    </div>
  );
};

export default BikerTasks;
