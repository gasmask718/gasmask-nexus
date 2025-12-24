import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Bike, Search, Filter, Plus, Edit, Phone, Mail, 
  MapPin, CheckCircle2, XCircle, Download, User
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBiker, setEditingBiker] = useState<Biker | null>(null);

  const { data: bikers = [], isLoading } = useQuery({
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

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              Bikers Management
            </h1>
            <p className="text-muted-foreground">Manage store checker bikers</p>
          </div>
          <div className="flex gap-2">
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
        <div className="grid grid-cols-3 gap-4">
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
        </div>

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
            {filteredBikers.map(biker => (
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
                    <Badge variant={biker.status === 'active' ? 'default' : 'secondary'}>
                      {biker.status}
                    </Badge>
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
                  
                  {biker.payout_method && (
                    <p className="text-sm text-muted-foreground">
                      Payout: {biker.payout_method} {biker.payout_handle && `(${biker.payout_handle})`}
                    </p>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditingBiker(biker)}>
                          <Edit className="h-4 w-4 mr-1" /> Edit
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
            ))}
          </div>
        )}
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
