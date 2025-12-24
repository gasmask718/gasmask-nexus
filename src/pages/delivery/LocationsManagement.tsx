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
import { toast } from 'sonner';
import { 
  MapPin, Search, Filter, Plus, Edit, Trash2, 
  Building2, Warehouse, Package, Phone, Download
} from 'lucide-react';
import { format } from 'date-fns';

type Location = {
  id: string;
  business_id: string;
  location_type: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  neighborhood: string | null;
  boro: string | null;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
};

const LOCATION_TYPES = ['store', 'warehouse', 'pickup', 'dropoff', 'other'];

const LocationsManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['delivery-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as unknown as Location[];
    }
  });

  // Create location
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Location>) => {
      const { error } = await supabase.from('locations').insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-locations'] });
      toast.success('Location created');
      setShowCreateDialog(false);
    },
    onError: () => toast.error('Failed to create location')
  });

  // Update location
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Location> }) => {
      const { error } = await supabase.from('locations').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-locations'] });
      toast.success('Location updated');
      setEditingLocation(null);
    },
    onError: () => toast.error('Failed to update location')
  });

  // Delete location
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-locations'] });
      toast.success('Location deleted');
    },
    onError: () => toast.error('Failed to delete location')
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'store': return <Building2 className="h-4 w-4" />;
      case 'warehouse': return <Warehouse className="h-4 w-4" />;
      case 'pickup': return <Package className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = 
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.address_line1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || loc.location_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const exportCSV = () => {
    const headers = ['Name', 'Type', 'Address', 'City', 'State', 'Zip', 'Contact', 'Phone'];
    const rows = filteredLocations.map(loc => [
      loc.name,
      loc.location_type,
      loc.address_line1,
      loc.city,
      loc.state,
      loc.zip,
      loc.contact_name || '',
      loc.contact_phone || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const typeCounts = LOCATION_TYPES.reduce((acc, type) => {
    acc[type] = locations.filter(l => l.location_type === type).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Locations
            </h1>
            <p className="text-muted-foreground">Manage stores, warehouses, and delivery points</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Location</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                </DialogHeader>
                <LocationForm 
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {LOCATION_TYPES.map(type => (
            <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter(type)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {getTypeIcon(type)}
                  <div>
                    <div className="text-2xl font-bold">{typeCounts[type] || 0}</div>
                    <p className="text-sm text-muted-foreground capitalize">{type}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, address, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {LOCATION_TYPES.map(type => (
                <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Locations Grid */}
        {isLoading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
        ) : filteredLocations.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No locations found</CardContent></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocations.map(location => (
              <Card key={location.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(location.location_type)}
                      <CardTitle className="text-lg">{location.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="capitalize">{location.location_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p>{location.address_line1}</p>
                    {location.address_line2 && <p>{location.address_line2}</p>}
                    <p>{location.city}, {location.state} {location.zip}</p>
                  </div>
                  
                  {(location.neighborhood || location.boro) && (
                    <div className="flex gap-2 flex-wrap">
                      {location.neighborhood && (
                        <Badge variant="secondary">{location.neighborhood}</Badge>
                      )}
                      {location.boro && (
                        <Badge variant="secondary">{location.boro}</Badge>
                      )}
                    </div>
                  )}
                  
                  {location.contact_name && (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium">{location.contact_name}</p>
                      {location.contact_phone && (
                        <a href={`tel:${location.contact_phone}`} className="flex items-center gap-1 text-primary">
                          <Phone className="h-3 w-3" /> {location.contact_phone}
                        </a>
                      )}
                    </div>
                  )}
                  
                  {location.notes && (
                    <p className="text-sm text-muted-foreground bg-muted p-2 rounded">{location.notes}</p>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setEditingLocation(location)}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Location</DialogTitle>
                        </DialogHeader>
                        <LocationForm 
                          initialData={location}
                          onSubmit={(data) => updateMutation.mutate({ id: location.id, data })}
                          isLoading={updateMutation.isPending}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => {
                        if (confirm('Delete this location?')) {
                          deleteMutation.mutate(location.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
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

// Location Form Component
const LocationForm: React.FC<{
  initialData?: Partial<Location>;
  onSubmit: (data: Partial<Location>) => void;
  isLoading: boolean;
}> = ({ initialData, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    location_type: initialData?.location_type || 'store',
    name: initialData?.name || '',
    address_line1: initialData?.address_line1 || '',
    address_line2: initialData?.address_line2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    zip: initialData?.zip || '',
    neighborhood: initialData?.neighborhood || '',
    boro: initialData?.boro || '',
    contact_name: initialData?.contact_name || '',
    contact_phone: initialData?.contact_phone || '',
    notes: initialData?.notes || ''
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Location Type</label>
          <Select value={formData.location_type} onValueChange={(v) => handleChange('location_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_TYPES.map(type => (
                <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input 
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Location name"
          />
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">Address Line 1</label>
        <Input 
          value={formData.address_line1}
          onChange={(e) => handleChange('address_line1', e.target.value)}
          placeholder="Street address"
        />
      </div>
      
      <div>
        <label className="text-sm font-medium">Address Line 2 (Optional)</label>
        <Input 
          value={formData.address_line2}
          onChange={(e) => handleChange('address_line2', e.target.value)}
          placeholder="Apt, Suite, etc."
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">City</label>
          <Input 
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">State</label>
          <Input 
            value={formData.state}
            onChange={(e) => handleChange('state', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Zip</label>
          <Input 
            value={formData.zip}
            onChange={(e) => handleChange('zip', e.target.value)}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Neighborhood (Optional)</label>
          <Input 
            value={formData.neighborhood}
            onChange={(e) => handleChange('neighborhood', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Borough (Optional)</label>
          <Input 
            value={formData.boro}
            onChange={(e) => handleChange('boro', e.target.value)}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Contact Name (Optional)</label>
          <Input 
            value={formData.contact_name}
            onChange={(e) => handleChange('contact_name', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Contact Phone (Optional)</label>
          <Input 
            value={formData.contact_phone}
            onChange={(e) => handleChange('contact_phone', e.target.value)}
          />
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">Notes (Optional)</label>
        <Textarea 
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>
      
      <Button 
        className="w-full" 
        onClick={() => onSubmit(formData)}
        disabled={!formData.name || !formData.address_line1 || !formData.city || isLoading}
      >
        {isLoading ? 'Saving...' : initialData ? 'Update Location' : 'Create Location'}
      </Button>
    </div>
  );
};

export default LocationsManagement;
