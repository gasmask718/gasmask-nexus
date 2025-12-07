import { useState, useEffect } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, MapPin, User, Building2, Home } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface FullContactFormProps {
  onSuccess?: () => void;
  editingContact?: any;
  brandColor?: string;
}

interface Borough {
  id: string;
  name: string;
}

interface Neighborhood {
  id: string;
  borough_id: string;
  name: string;
}

export const FullContactForm = ({ onSuccess, editingContact, brandColor = 'hsl(var(--primary))' }: FullContactFormProps) => {
  const { selectedBusiness } = useBusinessStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  // Add Neighborhood Modal state
  const [showAddNeighborhood, setShowAddNeighborhood] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newNeighborhoodBoroughId, setNewNeighborhoodBoroughId] = useState('');
  const [isAddingNeighborhood, setIsAddingNeighborhood] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'lead',
    organization: '',
    addressStreet: '',
    addressCity: '',
    addressState: 'NY',
    addressZip: '',
    boroughId: '',
    neighborhoodId: '',
    notes: '',
  });

  // Fetch boroughs
  const { data: boroughs = [] } = useQuery({
    queryKey: ['boroughs', selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boroughs')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Borough[];
    },
  });

  // Fetch neighborhoods based on selected borough
  const { data: neighborhoods = [], refetch: refetchNeighborhoods } = useQuery({
    queryKey: ['neighborhoods', formData.boroughId],
    queryFn: async () => {
      if (!formData.boroughId) return [];
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('borough_id', formData.boroughId)
        .order('name');
      if (error) throw error;
      return data as Neighborhood[];
    },
    enabled: !!formData.boroughId,
  });

  // Populate form when editing
  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name || '',
        email: editingContact.email || '',
        phone: editingContact.phone || '',
        type: editingContact.type || 'lead',
        organization: editingContact.organization || '',
        addressStreet: editingContact.address_street || '',
        addressCity: editingContact.address_city || '',
        addressState: editingContact.address_state || 'NY',
        addressZip: editingContact.address_zip || '',
        boroughId: editingContact.borough_id || '',
        neighborhoodId: editingContact.neighborhood_id || '',
        notes: editingContact.notes || '',
      });
    }
  }, [editingContact]);

  const handleAddNeighborhood = async () => {
    if (!newNeighborhoodName.trim() || !newNeighborhoodBoroughId) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setIsAddingNeighborhood(true);
    try {
      const { data, error } = await supabase
        .from('neighborhoods')
        .insert({
          borough_id: newNeighborhoodBoroughId,
          name: newNeighborhoodName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: `Added neighborhood: ${newNeighborhoodName}` });
      
      // If adding to currently selected borough, update the dropdown
      if (newNeighborhoodBoroughId === formData.boroughId) {
        await refetchNeighborhoods();
        setFormData(prev => ({ ...prev, neighborhoodId: data.id }));
      }
      
      setShowAddNeighborhood(false);
      setNewNeighborhoodName('');
      setNewNeighborhoodBoroughId('');
    } catch (error: any) {
      toast({ 
        title: 'Failed to add neighborhood', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsAddingNeighborhood(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id) {
      toast({ title: 'No business selected', variant: 'destructive' });
      return;
    }

    // Validate required fields
    if (!formData.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const contactPayload = {
        business_id: selectedBusiness.id,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        type: formData.type,
        organization: formData.organization.trim() || null,
        address_street: formData.addressStreet.trim() || null,
        address_city: formData.addressCity.trim() || null,
        address_state: formData.addressState.trim() || null,
        address_zip: formData.addressZip.trim() || null,
        borough_id: formData.boroughId || null,
        neighborhood_id: formData.neighborhoodId || null,
        notes: formData.notes.trim() || null,
        relationship_status: 'active',
        last_contact_date: new Date().toISOString(),
      };

      if (editingContact?.id) {
        const { error } = await supabase
          .from('crm_contacts')
          .update(contactPayload)
          .eq('id', editingContact.id);
        if (error) throw error;
        toast({
          title: 'Contact Updated',
          description: `${formData.name} has been updated.`,
        });
      } else {
        const { error } = await supabase
          .from('crm_contacts')
          .insert(contactPayload);
        if (error) throw error;
        toast({
          title: 'Contact Added',
          description: `${formData.name} has been added to your CRM.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['crm-contacts-list'] });
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        type: 'lead',
        organization: '',
        addressStreet: '',
        addressCity: '',
        addressState: 'NY',
        addressZip: '',
        boroughId: '',
        neighborhoodId: '',
        notes: '',
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Basic Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Basic Information</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter contact name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1-555-1234"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Contact Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="distributor">Distributor</SelectItem>
                <SelectItem value="wholesaler">Wholesaler</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
            <Input
              id="organization"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
              placeholder="Company or store name"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Address & Neighborhood */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Address & Location</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressStreet">Street Address</Label>
            <Input
              id="addressStreet"
              value={formData.addressStreet}
              onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
              placeholder="123 Main St"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="addressCity">City</Label>
              <Input
                id="addressCity"
                value={formData.addressCity}
                onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                placeholder="New York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressState">State</Label>
              <Input
                id="addressState"
                value={formData.addressState}
                onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                placeholder="NY"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressZip">Zip Code</Label>
            <Input
              id="addressZip"
              value={formData.addressZip}
              onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
              placeholder="10001"
            />
          </div>

          {/* Borough Dropdown */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Borough
            </Label>
            <Select 
              value={formData.boroughId} 
              onValueChange={(value) => setFormData({ 
                ...formData, 
                boroughId: value, 
                neighborhoodId: '' 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select borough..." />
              </SelectTrigger>
              <SelectContent>
                {boroughs.map((borough) => (
                  <SelectItem key={borough.id} value={borough.id}>
                    {borough.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Neighborhood Dropdown - Only show when borough is selected */}
          {formData.boroughId && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-muted-foreground" />
                Neighborhood
              </Label>
              <Select 
                value={formData.neighborhoodId} 
                onValueChange={(value) => setFormData({ ...formData, neighborhoodId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select neighborhood..." />
                </SelectTrigger>
                <SelectContent>
                  {neighborhoods.map((neighborhood) => (
                    <SelectItem key={neighborhood.id} value={neighborhood.id}>
                      {neighborhood.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Add Missing Neighborhood Link */}
              <button
                type="button"
                onClick={() => {
                  setNewNeighborhoodBoroughId(formData.boroughId);
                  setShowAddNeighborhood(true);
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" />
                Add Missing Neighborhood
              </button>
            </div>
          )}

          {/* Add Neighborhood Mini Modal */}
          {showAddNeighborhood && (
            <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
              <h4 className="text-sm font-medium">Add New Neighborhood</h4>
              <div className="space-y-2">
                <Label className="text-xs">Borough</Label>
                <Select 
                  value={newNeighborhoodBoroughId} 
                  onValueChange={setNewNeighborhoodBoroughId}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select borough" />
                  </SelectTrigger>
                  <SelectContent>
                    {boroughs.map((borough) => (
                      <SelectItem key={borough.id} value={borough.id}>
                        {borough.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Neighborhood Name</Label>
                <Input
                  value={newNeighborhoodName}
                  onChange={(e) => setNewNeighborhoodName(e.target.value)}
                  placeholder="Enter neighborhood name"
                  className="h-8"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  size="sm" 
                  onClick={handleAddNeighborhood}
                  disabled={isAddingNeighborhood}
                >
                  {isAddingNeighborhood ? 'Adding...' : 'Save'}
                </Button>
                <Button 
                  type="button"
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    setShowAddNeighborhood(false);
                    setNewNeighborhoodName('');
                    setNewNeighborhoodBoroughId('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM: Personal Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Personal Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add notes about this contact..."
          rows={3}
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading}
        style={{ backgroundColor: brandColor }}
      >
        <Plus className="mr-2 h-4 w-4" />
        {loading ? 'Saving...' : editingContact ? 'Update Contact' : 'Add Contact'}
      </Button>
    </form>
  );
};
