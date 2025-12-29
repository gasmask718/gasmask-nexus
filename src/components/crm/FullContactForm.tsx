import { useState, useEffect, useMemo, useCallback } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, MapPin, User, Building2, Home, Loader2, CheckCircle, AlertCircle, Sparkles, Map, UserCog } from 'lucide-react';
import { RoleSelector } from './RoleSelector';
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

// NYC ZIP Code to Borough mapping
const ZIP_TO_BOROUGH: Record<string, string> = {
  // Manhattan
  '10001': 'Manhattan', '10002': 'Manhattan', '10003': 'Manhattan', '10004': 'Manhattan', '10005': 'Manhattan',
  '10006': 'Manhattan', '10007': 'Manhattan', '10008': 'Manhattan', '10009': 'Manhattan', '10010': 'Manhattan',
  '10011': 'Manhattan', '10012': 'Manhattan', '10013': 'Manhattan', '10014': 'Manhattan', '10016': 'Manhattan',
  '10017': 'Manhattan', '10018': 'Manhattan', '10019': 'Manhattan', '10020': 'Manhattan', '10021': 'Manhattan',
  '10022': 'Manhattan', '10023': 'Manhattan', '10024': 'Manhattan', '10025': 'Manhattan', '10026': 'Manhattan',
  '10027': 'Manhattan', '10028': 'Manhattan', '10029': 'Manhattan', '10030': 'Manhattan', '10031': 'Manhattan',
  '10032': 'Manhattan', '10033': 'Manhattan', '10034': 'Manhattan', '10035': 'Manhattan', '10036': 'Manhattan',
  '10037': 'Manhattan', '10038': 'Manhattan', '10039': 'Manhattan', '10040': 'Manhattan', '10044': 'Manhattan',
  '10065': 'Manhattan', '10069': 'Manhattan', '10075': 'Manhattan', '10128': 'Manhattan', '10280': 'Manhattan',
  // Brooklyn
  '11201': 'Brooklyn', '11203': 'Brooklyn', '11204': 'Brooklyn', '11205': 'Brooklyn', '11206': 'Brooklyn',
  '11207': 'Brooklyn', '11208': 'Brooklyn', '11209': 'Brooklyn', '11210': 'Brooklyn', '11211': 'Brooklyn',
  '11212': 'Brooklyn', '11213': 'Brooklyn', '11214': 'Brooklyn', '11215': 'Brooklyn', '11216': 'Brooklyn',
  '11217': 'Brooklyn', '11218': 'Brooklyn', '11219': 'Brooklyn', '11220': 'Brooklyn', '11221': 'Brooklyn',
  '11222': 'Brooklyn', '11223': 'Brooklyn', '11224': 'Brooklyn', '11225': 'Brooklyn', '11226': 'Brooklyn',
  '11228': 'Brooklyn', '11229': 'Brooklyn', '11230': 'Brooklyn', '11231': 'Brooklyn', '11232': 'Brooklyn',
  '11233': 'Brooklyn', '11234': 'Brooklyn', '11235': 'Brooklyn', '11236': 'Brooklyn', '11237': 'Brooklyn',
  '11238': 'Brooklyn', '11239': 'Brooklyn',
  // Bronx
  '10451': 'Bronx', '10452': 'Bronx', '10453': 'Bronx', '10454': 'Bronx', '10455': 'Bronx',
  '10456': 'Bronx', '10457': 'Bronx', '10458': 'Bronx', '10459': 'Bronx', '10460': 'Bronx',
  '10461': 'Bronx', '10462': 'Bronx', '10463': 'Bronx', '10464': 'Bronx', '10465': 'Bronx',
  '10466': 'Bronx', '10467': 'Bronx', '10468': 'Bronx', '10469': 'Bronx', '10470': 'Bronx',
  '10471': 'Bronx', '10472': 'Bronx', '10473': 'Bronx', '10474': 'Bronx', '10475': 'Bronx',
  // Queens
  '11004': 'Queens', '11005': 'Queens', '11101': 'Queens', '11102': 'Queens', '11103': 'Queens',
  '11104': 'Queens', '11105': 'Queens', '11106': 'Queens', '11354': 'Queens', '11355': 'Queens',
  '11356': 'Queens', '11357': 'Queens', '11358': 'Queens', '11359': 'Queens', '11360': 'Queens',
  '11361': 'Queens', '11362': 'Queens', '11363': 'Queens', '11364': 'Queens', '11365': 'Queens',
  '11366': 'Queens', '11367': 'Queens', '11368': 'Queens', '11369': 'Queens', '11370': 'Queens',
  '11371': 'Queens', '11372': 'Queens', '11373': 'Queens', '11374': 'Queens', '11375': 'Queens',
  '11377': 'Queens', '11378': 'Queens', '11379': 'Queens', '11385': 'Queens', '11411': 'Queens',
  '11412': 'Queens', '11413': 'Queens', '11414': 'Queens', '11415': 'Queens', '11416': 'Queens',
  '11417': 'Queens', '11418': 'Queens', '11419': 'Queens', '11420': 'Queens', '11421': 'Queens',
  '11422': 'Queens', '11423': 'Queens', '11426': 'Queens', '11427': 'Queens', '11428': 'Queens',
  '11429': 'Queens', '11430': 'Queens', '11432': 'Queens', '11433': 'Queens', '11434': 'Queens',
  '11435': 'Queens', '11436': 'Queens', '11691': 'Queens', '11692': 'Queens', '11693': 'Queens',
  '11694': 'Queens', '11697': 'Queens',
  // Staten Island
  '10301': 'Staten Island', '10302': 'Staten Island', '10303': 'Staten Island', '10304': 'Staten Island',
  '10305': 'Staten Island', '10306': 'Staten Island', '10307': 'Staten Island', '10308': 'Staten Island',
  '10309': 'Staten Island', '10310': 'Staten Island', '10311': 'Staten Island', '10312': 'Staten Island',
  '10314': 'Staten Island',
};

// ZIP to neighborhood suggestions
const ZIP_TO_NEIGHBORHOOD: Record<string, string[]> = {
  '11211': ['Williamsburg', 'East Williamsburg'],
  '11206': ['Bushwick', 'East Williamsburg'],
  '11237': ['Bushwick'],
  '11221': ['Bushwick', 'Bedford-Stuyvesant'],
  '11238': ['Prospect Heights', 'Crown Heights'],
  '11216': ['Bedford-Stuyvesant'],
  '11213': ['Crown Heights'],
  '11225': ['Crown Heights', 'Lefferts Gardens'],
  '11226': ['Flatbush'],
  '11210': ['Flatbush', 'Midwood'],
  '11207': ['East New York'],
  '11208': ['East New York', 'Cypress Hills'],
  '11236': ['Canarsie'],
  '11239': ['Canarsie', 'Starrett City'],
  '10451': ['Mott Haven', 'Melrose'],
  '10452': ['Highbridge', 'Concourse'],
  '10453': ['Morris Heights', 'University Heights'],
  '10456': ['Morrisania', 'Claremont'],
  '10459': ['Longwood', 'Hunts Point'],
  '10001': ['Chelsea', 'Midtown'],
  '10002': ['Lower East Side', 'Chinatown'],
  '10003': ['East Village', 'Greenwich Village'],
  '10011': ['Chelsea', 'West Village'],
  '10012': ['SoHo', 'NoHo'],
  '10013': ['Tribeca', 'Chinatown'],
  '10014': ['West Village', 'Greenwich Village'],
  '10019': ['Midtown West', 'Hell\'s Kitchen'],
  '10025': ['Upper West Side', 'Manhattan Valley'],
  '10027': ['Harlem'],
  '10029': ['East Harlem', 'Spanish Harlem'],
  '11101': ['Long Island City'],
  '11102': ['Astoria'],
  '11103': ['Astoria'],
  '11104': ['Sunnyside'],
  '11105': ['Astoria', 'Ditmars'],
  '11354': ['Flushing'],
  '11355': ['Flushing'],
  '11368': ['Corona'],
  '11373': ['Elmhurst'],
  '11375': ['Forest Hills'],
  '11377': ['Woodside'],
  '11385': ['Ridgewood', 'Glendale'],
};

const SMART_NOTE_PROMPTS = [
  { label: 'Store behavior', prompt: '📦 Store behavior: ' },
  { label: 'Manager names', prompt: '👤 Key contacts: ' },
  { label: 'Order preferences', prompt: '🛒 Order preferences: ' },
  { label: 'Best contact times', prompt: '⏰ Best times to reach: ' },
  { label: 'Relationship notes', prompt: '🤝 Relationship notes: ' },
];

export const FullContactForm = ({ onSuccess, editingContact, brandColor = 'hsl(var(--primary))' }: FullContactFormProps) => {
  const { selectedBusiness } = useBusinessStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [addressValidationStatus, setAddressValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  
  // Add Neighborhood Modal state
  const [showAddNeighborhood, setShowAddNeighborhood] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newNeighborhoodBoroughId, setNewNeighborhoodBoroughId] = useState('');
  const [isAddingNeighborhood, setIsAddingNeighborhood] = useState(false);
  const [suggestedNeighborhoods, setSuggestedNeighborhoods] = useState<string[]>([]);
  
  // Company management state
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState('retail');
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'lead',
    roleId: '',
    organization: '',
    companyId: '',
    addressStreet: '',
    addressCity: '',
    addressState: 'NY',
    addressZip: '',
    boroughId: '',
    neighborhoodId: '',
    notes: '',
  });

  // Fetch companies
  const { data: companies = [], refetch: refetchCompanies } = useQuery({
    queryKey: ['companies-for-contact'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, type')
        .order('name');
      if (error) throw error;
      return data || [];
    },
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

  // Auto-detect City, State, Borough from ZIP code
  const handleZipChange = useCallback((zip: string) => {
    setFormData(prev => ({ ...prev, addressZip: zip }));
    
    if (zip.length === 5) {
      const boroughName = ZIP_TO_BOROUGH[zip];
      if (boroughName) {
        // Find borough ID
        const matchedBorough = boroughs.find(b => 
          b.name.toLowerCase() === boroughName.toLowerCase()
        );
        
        setFormData(prev => ({
          ...prev,
          addressZip: zip,
          addressCity: 'New York',
          addressState: 'NY',
          boroughId: matchedBorough?.id || prev.boroughId,
        }));

        // Set neighborhood suggestions
        const suggestions = ZIP_TO_NEIGHBORHOOD[zip] || [];
        setSuggestedNeighborhoods(suggestions);
        
        toast({
          title: 'Location detected',
          description: `${boroughName}, New York`,
        });
      }
    }
  }, [boroughs]);

  // Validate address before saving
  const validateAddress = useCallback(() => {
    setAddressValidationStatus('validating');
    
    // Simple validation: check if we have enough address components
    const hasStreet = formData.addressStreet.trim().length > 0;
    const hasCity = formData.addressCity.trim().length > 0;
    const hasState = formData.addressState.trim().length > 0;
    const hasZip = formData.addressZip.trim().length >= 5;
    
    setTimeout(() => {
      if (hasStreet && hasCity && hasState && hasZip) {
        setAddressValidationStatus('valid');
      } else if (hasStreet || hasCity || hasZip) {
        setAddressValidationStatus('invalid');
      } else {
        setAddressValidationStatus('idle');
      }
    }, 500);
  }, [formData.addressStreet, formData.addressCity, formData.addressState, formData.addressZip]);

  // Trigger validation when address fields change
  useEffect(() => {
    const timer = setTimeout(validateAddress, 300);
    return () => clearTimeout(timer);
  }, [formData.addressStreet, formData.addressCity, formData.addressState, formData.addressZip, validateAddress]);

  // Auto-suggest neighborhood based on suggestions
  useEffect(() => {
    if (suggestedNeighborhoods.length > 0 && neighborhoods.length > 0 && !formData.neighborhoodId) {
      const matchedNeighborhood = neighborhoods.find(n => 
        suggestedNeighborhoods.some(s => 
          n.name.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(n.name.toLowerCase())
        )
      );
      if (matchedNeighborhood) {
        setFormData(prev => ({ ...prev, neighborhoodId: matchedNeighborhood.id }));
      }
    }
  }, [suggestedNeighborhoods, neighborhoods, formData.neighborhoodId]);

  // Populate form when editing
  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name || '',
        email: editingContact.email || '',
        phone: editingContact.phone || '',
        type: editingContact.type || 'lead',
        roleId: editingContact.role_id || '',
        organization: editingContact.organization || '',
        companyId: editingContact.company_id || '',
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
      
      // Invalidate all neighborhood queries to update all open forms
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      
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

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({ title: 'Please enter a company name', variant: 'destructive' });
      return;
    }

    setIsAddingCompany(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: newCompanyName.trim(),
          type: newCompanyType,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: `Added company: ${newCompanyName}` });
      
      await refetchCompanies();
      setFormData(prev => ({ ...prev, companyId: data.id }));
      
      setShowAddCompany(false);
      setNewCompanyName('');
      setNewCompanyType('retail');
    } catch (error: any) {
      toast({ 
        title: 'Failed to add company', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsAddingCompany(false);
    }
  };

  const addSmartPrompt = (prompt: string) => {
    setFormData(prev => ({
      ...prev,
      notes: prev.notes + (prev.notes ? '\n' : '') + prompt,
    }));
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

    // Check address validity if partial address provided
    if (addressValidationStatus === 'invalid') {
      toast({ 
        title: 'Incomplete address', 
        description: 'Please complete the address fields or clear them.',
        variant: 'destructive' 
      });
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
        role_id: formData.roleId || null,
        organization: formData.organization.trim() || null,
        company_id: formData.companyId || null,
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
        roleId: '',
        organization: '',
        companyId: '',
        addressStreet: '',
        addressCity: '',
        addressState: 'NY',
        addressZip: '',
        boroughId: '',
        neighborhoodId: '',
        notes: '',
      });
      setSuggestedNeighborhoods([]);
      setAddressValidationStatus('idle');
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

  // Generate static map preview URL
  const mapPreviewUrl = useMemo(() => {
    if (!formData.addressStreet || !formData.addressCity) return null;
    const address = encodeURIComponent(
      `${formData.addressStreet}, ${formData.addressCity}, ${formData.addressState} ${formData.addressZip}`
    );
    // Using a placeholder map image with coordinates approximation
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+${brandColor?.replace('#', '') || 'ff0000'}(-73.9857,40.7484)/-73.9857,40.7484,13,0/300x150@2x?access_token=pk.placeholder`;
  }, [formData.addressStreet, formData.addressCity, formData.addressState, formData.addressZip, brandColor]);

  const selectedBorough = boroughs.find(b => b.id === formData.boroughId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Basic Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4" style={{ color: brandColor }} />
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

          {/* Company Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Company
            </Label>
            <div className="flex gap-2">
              <Select 
                value={formData.companyId} 
                onValueChange={(value) => setFormData({ ...formData, companyId: value === 'none' ? '' : value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select company (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} <span className="text-muted-foreground text-xs">({company.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => setShowAddCompany(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
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

          {/* Primary Role with Add New */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <UserCog className="w-3.5 h-3.5 text-muted-foreground" />
              Primary Role
            </Label>
            <RoleSelector
              value={formData.roleId}
              onValueChange={(roleId) => setFormData({ ...formData, roleId })}
              placeholder="Select role..."
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Address & Neighborhood */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: brandColor }} />
              <h3 className="font-semibold text-foreground text-sm">Address & Location</h3>
            </div>
            {addressValidationStatus === 'validating' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {addressValidationStatus === 'valid' && (
              <div className="flex items-center gap-1 text-green-500 text-xs">
                <CheckCircle className="w-3 h-3" />
                Valid
              </div>
            )}
            {addressValidationStatus === 'invalid' && (
              <div className="flex items-center gap-1 text-destructive text-xs">
                <AlertCircle className="w-3 h-3" />
                Incomplete
              </div>
            )}
          </div>

          {/* ZIP Code with auto-detect - moved to top for better UX */}
          <div className="space-y-2">
            <Label htmlFor="addressZip" className="flex items-center gap-1.5">
              Zip Code
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                Auto-detect
              </Badge>
            </Label>
            <Input
              id="addressZip"
              value={formData.addressZip}
              onChange={(e) => handleZipChange(e.target.value)}
              placeholder="Enter ZIP to auto-fill"
              maxLength={5}
            />
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

          {/* Borough Dropdown */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Borough
            </Label>
            <Select 
              value={formData.boroughId} 
              onValueChange={(value) => {
                setFormData({ 
                  ...formData, 
                  boroughId: value, 
                  neighborhoodId: '' 
                });
                setSuggestedNeighborhoods([]);
              }}
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
                {suggestedNeighborhoods.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-1">
                    Suggested
                  </Badge>
                )}
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
                      {suggestedNeighborhoods.some(s => 
                        neighborhood.name.toLowerCase().includes(s.toLowerCase())
                      ) && (
                        <span className="ml-2 text-primary">★</span>
                      )}
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
                className="text-xs hover:underline flex items-center gap-1 mt-1"
                style={{ color: brandColor }}
              >
                <Plus className="w-3 h-3" />
                Add Missing Neighborhood
              </button>
            </div>
          )}

          {/* Static Map Preview */}
          {formData.addressStreet && formData.addressCity && addressValidationStatus === 'valid' && (
            <div className="mt-3 rounded-lg overflow-hidden border border-border bg-secondary/30">
              <div className="h-24 bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Map className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">
                    {formData.addressStreet}
                  </p>
                  <p className="text-[10px]">
                    {selectedBorough?.name || formData.addressCity}, {formData.addressState}
                  </p>
                </div>
              </div>
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
                  style={{ backgroundColor: brandColor }}
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

      {/* BOTTOM: Personal Notes with Smart Prompts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="notes">Personal Notes</Label>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Smart prompts:</span>
          </div>
        </div>
        
        {/* Smart Prompt Chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SMART_NOTE_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => addSmartPrompt(item.prompt)}
              className="text-[10px] px-2 py-1 rounded-full border border-border bg-secondary/50 hover:bg-secondary transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
        
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add notes about this contact..."
          rows={4}
          className="resize-none"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading}
        style={{ backgroundColor: brandColor }}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            {editingContact ? 'Update Contact' : 'Add Contact'}
          </>
        )}
      </Button>

      {/* Add Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCompanyName">Company Name *</Label>
              <Input
                id="newCompanyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCompanyType">Company Type</Label>
              <Select value={newCompanyType} onValueChange={setNewCompanyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="distributor">Distributor</SelectItem>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCompany(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCompany} disabled={isAddingCompany}>
              {isAddingCompany ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
};
