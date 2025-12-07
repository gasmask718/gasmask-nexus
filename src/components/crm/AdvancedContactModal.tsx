import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, X, Plus, User, Phone, Mail, Store, Briefcase, MapPin, Building2, Home, Sparkles, Check, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { PersonalNotesEditor } from './PersonalNotesEditor';

interface AdvancedContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandKey: string;
  brandLabel: string;
  brandColor: string;
  accounts: any[];
  editingContact?: any;
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

const DEFAULT_ROLES = [
  { name: 'Owner', color: 'hsl(0, 100%, 50%)' },
  { name: 'Manager', color: 'hsl(210, 100%, 50%)' },
  { name: 'Buyer', color: 'hsl(142, 76%, 36%)' },
  { name: 'Assistant', color: 'hsl(270, 100%, 60%)' },
  { name: 'Accounting', color: 'hsl(38, 92%, 50%)' },
  { name: 'Marketing', color: 'hsl(330, 100%, 60%)' },
  { name: 'Decision Maker', color: 'hsl(240, 100%, 60%)' },
  { name: 'Other', color: 'hsl(0, 0%, 50%)' },
];

const COMMUNICATION_METHODS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageCircle },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const BUSINESS_TYPES = [
  { value: 'store', label: 'Store' },
  { value: 'contact', label: 'Contact' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'wholesaler', label: 'Wholesaler' },
];

export function AdvancedContactModal({ 
  open, 
  onOpenChange, 
  brandKey, 
  brandLabel, 
  brandColor,
  accounts,
  editingContact
}: AdvancedContactModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);
  const [availableRoles, setAvailableRoles] = useState(DEFAULT_ROLES);
  const [storeSearch, setStoreSearch] = useState('');
  
  // Add Neighborhood Modal state
  const [showAddNeighborhood, setShowAddNeighborhood] = useState(false);
  const [newNeighborhoodName, setNewNeighborhoodName] = useState('');
  const [newNeighborhoodBoroughId, setNewNeighborhoodBoroughId] = useState('');
  const [isAddingNeighborhood, setIsAddingNeighborhood] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    contactName: '',
    phone: '',
    email: '',
    position: '',
    businessType: 'store',
    preferredComm: 'call',
    primaryRole: '',
    additionalRoles: [] as string[],
    linkedStores: [] as string[],
    notes: '',
    isPrimaryContact: false,
    addressStreet: '',
    addressCity: '',
    addressState: 'NY',
    addressZip: '',
    boroughId: '',
    neighborhoodId: '',
  });

  // Fetch boroughs
  const { data: boroughs = [] } = useQuery({
    queryKey: ['boroughs'],
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

  // Generate initials from name
  const initials = useMemo(() => {
    const parts = formData.contactName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || '?';
  }, [formData.contactName]);

  // Filter stores by search
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return accounts;
    const query = storeSearch.toLowerCase();
    return accounts.filter(a => 
      a.store_master?.store_name?.toLowerCase().includes(query) ||
      a.store_master?.city?.toLowerCase().includes(query) ||
      a.store_master?.state?.toLowerCase().includes(query)
    );
  }, [accounts, storeSearch]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return formData.contactName.trim().length > 0 && formData.primaryRole.length > 0;
  }, [formData.contactName, formData.primaryRole]);

  // Populate form when editing
  useEffect(() => {
    if (editingContact && open) {
      setFormData({
        contactName: editingContact.contact_name || '',
        phone: editingContact.contact_phone || '',
        email: editingContact.contact_email || '',
        position: editingContact.position || '',
        businessType: editingContact.business_type || 'store',
        preferredComm: editingContact.preferred_comm || 'call',
        primaryRole: editingContact.primary_role?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || '',
        additionalRoles: editingContact.additional_roles?.map((r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())) || [],
        linkedStores: [],
        notes: editingContact.notes || '',
        isPrimaryContact: editingContact.is_primary_contact || false,
        addressStreet: editingContact.address_street || '',
        addressCity: editingContact.address_city || '',
        addressState: editingContact.address_state || 'NY',
        addressZip: editingContact.address_zip || '',
        boroughId: editingContact.borough_id || '',
        neighborhoodId: editingContact.neighborhood_id || '',
      });
    }
  }, [editingContact, open]);

  // Fetch custom roles on mount
  useEffect(() => {
    const fetchCustomRoles = async () => {
      const { data } = await supabase
        .from('custom_contact_roles')
        .select('role_name, color')
        .or(`brand.is.null,brand.eq.${brandLabel}`);
      
      if (data && data.length > 0) {
        const customRoles = data.map(r => ({ name: r.role_name, color: r.color || 'hsl(0, 0%, 50%)' }));
        const allRoles = [...DEFAULT_ROLES];
        customRoles.forEach(cr => {
          if (!allRoles.find(r => r.name.toLowerCase() === cr.name.toLowerCase())) {
            allRoles.push(cr);
          }
        });
        setAvailableRoles(allRoles);
      }
    };
    
    if (open) {
      fetchCustomRoles();
    }
  }, [open, brandLabel]);

  const resetForm = () => {
    setFormData({
      contactName: '',
      phone: '',
      email: '',
      position: '',
      businessType: 'store',
      preferredComm: 'call',
      primaryRole: '',
      additionalRoles: [],
      linkedStores: [],
      notes: '',
      isPrimaryContact: false,
      addressStreet: '',
      addressCity: '',
      addressState: 'NY',
      addressZip: '',
      boroughId: '',
      neighborhoodId: '',
    });
    setCustomRoleInput('');
    setShowCustomRoleInput(false);
    setStoreSearch('');
  };

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

  const handleAddCustomRole = async () => {
    if (!customRoleInput.trim()) return;
    
    const newRoleName = customRoleInput.trim();
    if (availableRoles.find(r => r.name.toLowerCase() === newRoleName.toLowerCase())) {
      toast({ title: 'Role already exists', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('custom_contact_roles')
      .insert({ role_name: newRoleName, brand: brandLabel });

    if (!error) {
      const newRole = { name: newRoleName, color: 'hsl(0, 0%, 50%)' };
      setAvailableRoles([...availableRoles, newRole]);
      setFormData(prev => ({ ...prev, additionalRoles: [...prev.additionalRoles, newRoleName] }));
      setCustomRoleInput('');
      setShowCustomRoleInput(false);
      toast({ title: `Added role: ${newRoleName}` });
    }
  };

  const toggleAdditionalRole = (role: string) => {
    if (role === formData.primaryRole) return;
    
    setFormData(prev => ({
      ...prev,
      additionalRoles: prev.additionalRoles.includes(role)
        ? prev.additionalRoles.filter(r => r !== role)
        : [...prev.additionalRoles, role]
    }));
  };

  const toggleLinkedStore = (storeId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedStores: prev.linkedStores.includes(storeId)
        ? prev.linkedStores.filter(s => s !== storeId)
        : [...prev.linkedStores, storeId]
    }));
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast({ title: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      let storeBrandAccountId: string | null = null;
      
      if (formData.linkedStores.length > 0) {
        const linkedAccount = accounts.find(a => a.store_master_id === formData.linkedStores[0]);
        if (linkedAccount) {
          storeBrandAccountId = linkedAccount.id;
        }
      }
      
      if (!storeBrandAccountId && accounts.length > 0) {
        storeBrandAccountId = accounts[0].id;
      }

      if (!storeBrandAccountId) {
        const { data: anyStore } = await supabase
          .from('store_master')
          .select('id')
          .limit(1)
          .single();
        
        if (anyStore) {
          const insertData = {
            store_master_id: anyStore.id,
            brand: brandLabel as 'GasMask' | 'GrabbaRUs' | 'HotMama' | 'HotScalati',
            active_status: true,
            loyalty_level: 'Bronze' as const,
            credit_terms: 'COD' as const,
            total_spent: 0
          };
          
          const { data: newAccount, error: createError } = await supabase
            .from('store_brand_accounts')
            .insert([insertData])
            .select('id')
            .single();
          
          if (createError) throw new Error('Failed to create brand account');
          storeBrandAccountId = newAccount?.id || null;
        }
      }

      if (!storeBrandAccountId) {
        throw new Error('No store_brand_account available. Please add stores first.');
      }

      const contactData = {
        store_brand_account_id: storeBrandAccountId,
        brand: brandLabel as any,
        contact_name: formData.contactName.trim(),
        contact_phone: formData.phone.trim() || null,
        contact_email: formData.email.trim() || null,
        primary_role: formData.primaryRole.toLowerCase().replace(/ /g, '_'),
        additional_roles: formData.additionalRoles.map(r => r.toLowerCase().replace(/ /g, '_')),
        notes: formData.notes.trim() || null,
        is_primary_contact: formData.isPrimaryContact,
        tags: [formData.primaryRole, ...formData.additionalRoles],
        address_street: formData.addressStreet.trim() || null,
        address_city: formData.addressCity.trim() || null,
        address_state: formData.addressState.trim() || null,
        address_zip: formData.addressZip.trim() || null,
        borough_id: formData.boroughId || null,
        neighborhood_id: formData.neighborhoodId || null,
      };

      let contact;
      if (editingContact?.id) {
        const { data, error } = await supabase
          .from('brand_crm_contacts')
          .update(contactData)
          .eq('id', editingContact.id)
          .select('id')
          .single();
        if (error) throw error;
        contact = data;
      } else {
        const { data, error } = await supabase
          .from('brand_crm_contacts')
          .insert(contactData)
          .select('id')
          .single();
        if (error) throw error;
        contact = data;
      }

      if (contact?.id && formData.linkedStores.length > 0 && !editingContact) {
        const storeLinks = formData.linkedStores.map(storeId => ({
          contact_id: contact.id,
          store_master_id: storeId,
          brand: brandLabel,
        }));

        await supabase
          .from('brand_contact_store_links')
          .insert(storeLinks);
      }

      toast({ 
        title: editingContact ? 'Contact updated successfully' : 'Contact added successfully',
        description: `${formData.contactName} has been ${editingContact ? 'updated in' : 'added to'} ${brandLabel}.`
      });
      
      queryClient.invalidateQueries({ queryKey: ['brand-crm-contacts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-contact-store-links', brandKey] });
      
      resetForm();
      onOpenChange(false);
      
    } catch (error: any) {
      toast({ 
        title: 'Failed to save contact', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleColor = (roleName: string) => {
    return availableRoles.find(r => r.name === roleName)?.color || 'hsl(0, 0%, 50%)';
  };

  const selectedBorough = boroughs.find(b => b.id === formData.boroughId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0 gap-0 bg-card border-border/50 shadow-2xl">
        {/* Brand-Aware Header */}
        <div 
          className="px-6 py-5 border-b border-border/50"
          style={{ 
            background: `linear-gradient(135deg, ${brandColor}15 0%, ${brandColor}05 100%)`,
            borderTop: `3px solid ${brandColor}`
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: brandColor }}
            >
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Brand CRM → {brandLabel} Stores
              </DialogDescription>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[calc(95vh-180px)]">
          <div className="p-6 space-y-6">
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT COLUMN: Basic Info */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" style={{ color: brandColor }} />
                  <h3 className="font-semibold text-foreground">Basic Information</h3>
                </div>
                
                {/* Identity Card */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                      style={{ 
                        backgroundColor: formData.contactName ? brandColor : 'hsl(var(--muted))',
                        color: formData.contactName ? 'white' : 'hsl(var(--muted-foreground))'
                      }}
                    >
                      {formData.contactName ? initials : <User className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Full Name *</Label>
                        <Input
                          placeholder="Contact's full name"
                          value={formData.contactName}
                          onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                          className="bg-background/50 border-border/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="+1 (555) 123-4567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="pl-10 bg-background/50 border-border/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="contact@store.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="pl-10 bg-background/50 border-border/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Business Type</Label>
                      <Select 
                        value={formData.businessType} 
                        onValueChange={(val) => setFormData({ ...formData, businessType: val })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Preferred Comm</Label>
                      <Select 
                        value={formData.preferredComm} 
                        onValueChange={(val) => setFormData({ ...formData, preferredComm: val })}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMUNICATION_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              <div className="flex items-center gap-2">
                                <method.icon className="w-4 h-4" />
                                {method.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Primary Role */}
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Primary Role *</Label>
                    <Select 
                      value={formData.primaryRole} 
                      onValueChange={(val) => setFormData({ 
                        ...formData, 
                        primaryRole: val,
                        additionalRoles: formData.additionalRoles.filter(r => r !== val)
                      })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <SelectValue placeholder="Select primary role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: role.color }} 
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Additional Roles */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Additional Roles</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableRoles
                        .filter(r => r.name !== formData.primaryRole)
                        .slice(0, 6)
                        .map((role) => {
                          const isSelected = formData.additionalRoles.includes(role.name);
                          return (
                            <Badge
                              key={role.name}
                              variant={isSelected ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              style={isSelected ? { backgroundColor: role.color } : {}}
                              onClick={() => toggleAdditionalRole(role.name)}
                            >
                              {isSelected && <Check className="w-3 h-3 mr-1" />}
                              {role.name}
                            </Badge>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Address & Neighborhood */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" style={{ color: brandColor }} />
                  <h3 className="font-semibold text-foreground">Address & Neighborhood</h3>
                </div>
                
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/30 space-y-4">
                  {/* Street Address */}
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Street Address</Label>
                    <div className="relative">
                      <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="123 Main Street"
                        value={formData.addressStreet}
                        onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                        className="pl-10 bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                  
                  {/* City, State, ZIP */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">City</Label>
                      <Input
                        placeholder="New York"
                        value={formData.addressCity}
                        onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">State</Label>
                      <Input
                        placeholder="NY"
                        value={formData.addressState}
                        onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">ZIP</Label>
                      <Input
                        placeholder="10001"
                        value={formData.addressZip}
                        onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                  </div>

                  {/* Borough Dropdown */}
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Borough</Label>
                    <Select 
                      value={formData.boroughId} 
                      onValueChange={(val) => setFormData({ 
                        ...formData, 
                        boroughId: val,
                        neighborhoodId: '' // Reset neighborhood when borough changes
                      })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <SelectValue placeholder="Select borough..." />
                        </div>
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

                  {/* Neighborhood Dropdown */}
                  <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Neighborhood</Label>
                    <Select 
                      value={formData.neighborhoodId} 
                      onValueChange={(val) => setFormData({ ...formData, neighborhoodId: val })}
                      disabled={!formData.boroughId}
                    >
                      <SelectTrigger className={cn(
                        "bg-background/50 border-border/50",
                        !formData.boroughId && "opacity-50"
                      )}>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <SelectValue placeholder={formData.boroughId ? "Select neighborhood..." : "Select borough first"} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {neighborhoods.map((neighborhood) => (
                          <SelectItem key={neighborhood.id} value={neighborhood.id}>
                            {neighborhood.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Add Missing Neighborhood Link */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewNeighborhoodBoroughId(formData.boroughId);
                      setShowAddNeighborhood(true);
                    }}
                    className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
                    style={{ color: brandColor }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Missing Neighborhood
                  </button>
                </div>

                {/* Linked Stores */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" style={{ color: brandColor }} />
                    <h4 className="font-medium text-sm text-foreground">Link to Stores</h4>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search stores..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background/50 border border-border/50 rounded-md"
                    />
                  </div>
                  
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredStores.slice(0, 10).map((account) => {
                      const store = account.store_master;
                      const isSelected = formData.linkedStores.includes(account.store_master_id);
                      return (
                        <div
                          key={account.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                          )}
                          onClick={() => toggleLinkedStore(account.store_master_id)}
                        >
                          <Checkbox checked={isSelected} />
                          <span className="text-sm truncate">{store?.store_name || 'Unknown Store'}</span>
                          <span className="text-xs text-muted-foreground">{store?.city}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* FULL WIDTH: Personal Notes */}
            <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: brandColor }} />
                <h3 className="font-semibold text-foreground">Personal Notes</h3>
              </div>
              
              {editingContact?.id ? (
                <PersonalNotesEditor
                  entityType="contact"
                  entityId={editingContact.id}
                  brandColor={brandColor}
                  className="min-h-[120px]"
                />
              ) : (
                <Textarea
                  placeholder="Store habits, manager names, preferred pickup times, relationship notes, order quirks..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[120px] bg-background/50 border-border/50 resize-none"
                />
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="primary-contact"
              checked={formData.isPrimaryContact}
              onCheckedChange={(checked) => setFormData({ ...formData, isPrimaryContact: !!checked })}
            />
            <Label htmlFor="primary-contact" className="text-sm text-muted-foreground cursor-pointer">
              Set as Primary Contact
            </Label>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              style={{ backgroundColor: brandColor }}
              className="text-white hover:opacity-90"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingContact ? 'Save Changes' : 'Save Contact'}
            </Button>
          </div>
        </div>

        {/* Add Neighborhood Sub-Modal */}
        {showAddNeighborhood && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div 
              className="bg-card rounded-xl border shadow-2xl p-6 w-full max-w-md"
              style={{ borderTop: `3px solid ${brandColor}` }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add a New Neighborhood</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddNeighborhood(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Borough</Label>
                  <Select 
                    value={newNeighborhoodBoroughId} 
                    onValueChange={setNewNeighborhoodBoroughId}
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
                
                <div className="space-y-2">
                  <Label>Neighborhood Name</Label>
                  <Input
                    placeholder="e.g. East Williamsburg"
                    value={newNeighborhoodName}
                    onChange={(e) => setNewNeighborhoodName(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={handleAddNeighborhood}
                  disabled={isAddingNeighborhood || !newNeighborhoodName.trim() || !newNeighborhoodBoroughId}
                  className="w-full"
                  style={{ backgroundColor: brandColor }}
                >
                  {isAddingNeighborhood && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Neighborhood
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
