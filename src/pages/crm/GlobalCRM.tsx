import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, Users, Search, Plus, Settings, MapPin, 
  UserCog, Phone, Edit, Archive, Eye, Store, Trash2, Check, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FullContactForm } from '@/components/crm/FullContactForm';
import { useBoroughs, useAddBorough } from '@/hooks/useBoroughs';
import { useCustomerRoles, useAddCustomerRole } from '@/hooks/useCustomerRoles';
import { toast } from 'sonner';
import CRMLayout from './CRMLayout';

interface Brand {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  active: boolean | null;
}

const GlobalCRM = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [boroughFilter, setBoroughFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [showAddContact, setShowAddContact] = useState(false);
  
  // Admin settings state
  const [newBoroughName, setNewBoroughName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandColor, setEditBrandColor] = useState('');

  const { data: boroughs = [] } = useBoroughs();
  const { data: roles = [] } = useCustomerRoles();
  const addBorough = useAddBorough();
  const addRole = useAddCustomerRole();

  // Fetch all brands (from brands table)
  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['global-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Brand[];
    },
  });

  // Fetch all businesses (from businesses table - for Global CRM Home)
  const { data: allBusinesses = [], isLoading: businessesLoading } = useQuery({
    queryKey: ['global-businesses-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch brand stats (store count, contact count)
  const { data: brandStats = {} } = useQuery({
    queryKey: ['global-brand-stats'],
    queryFn: async () => {
      const stats: Record<string, { storeCount: number; contactCount: number }> = {};
      
      // Get store counts per brand from store_brand_accounts
      const { data: storeCounts } = await supabase
        .from('store_brand_accounts')
        .select('brand');
      
      // Get contact counts per brand
      const { data: contacts } = await supabase
        .from('brand_crm_contacts')
        .select('brand');

      // Get business contact counts from crm_contacts
      const { data: businessContacts } = await supabase
        .from('crm_contacts')
        .select('business_id')
        .is('deleted_at', null);
      
      // Aggregate store counts by brand name
      storeCounts?.forEach((s: any) => {
        const brand = s.brand;
        if (!stats[brand]) stats[brand] = { storeCount: 0, contactCount: 0 };
        stats[brand].storeCount++;
      });
      
      // Aggregate contact counts by brand name
      contacts?.forEach((c: any) => {
        const brand = c.brand;
        if (!stats[brand]) stats[brand] = { storeCount: 0, contactCount: 0 };
        stats[brand].contactCount++;
      });

      // Aggregate contact counts by business_id
      businessContacts?.forEach((c: any) => {
        const businessId = c.business_id;
        if (businessId) {
          if (!stats[businessId]) stats[businessId] = { storeCount: 0, contactCount: 0 };
          stats[businessId].contactCount++;
        }
      });
      
      return stats;
    },
  });

  // Fetch all contacts across all brands
  const { data: allContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['global-all-contacts', searchTerm, boroughFilter, roleFilter, brandFilter],
    queryFn: async () => {
      let query = supabase
        .from('crm_contacts')
        .select(`
          *,
          borough:boroughs(id, name),
          role:customer_roles(id, role_name),
          business:businesses(id, name)
        `)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      if (boroughFilter !== 'all') {
        query = query.eq('borough_id', boroughFilter);
      }
      
      if (roleFilter !== 'all') {
        query = query.eq('role_id', roleFilter);
      }

      if (brandFilter !== 'all') {
        query = query.eq('business_id', brandFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch businesses for dropdown
  const { data: businesses = [] } = useQuery({
    queryKey: ['global-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Update brand mutation
  const updateBrandMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('brands')
        .update({ name, color })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-brands'] });
      toast.success('Brand updated');
      setEditingBrandId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete brand mutation
  const deleteBrandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('brands')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-brands'] });
      toast.success('Brand deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddBorough = () => {
    if (!newBoroughName.trim()) return;
    addBorough.mutate(newBoroughName.trim(), {
      onSuccess: () => setNewBoroughName(''),
    });
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    addRole.mutate(newRoleName.trim(), {
      onSuccess: () => setNewRoleName(''),
    });
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrandId(brand.id);
    setEditBrandName(brand.name);
    setEditBrandColor(brand.color || '#6366f1');
  };

  const handleSaveBrand = () => {
    if (!editingBrandId || !editBrandName.trim()) return;
    updateBrandMutation.mutate({
      id: editingBrandId,
      name: editBrandName.trim(),
      color: editBrandColor,
    });
  };

  const filteredBrands = brands.filter(b => 
    b.active !== false && (!searchTerm || b.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <CRMLayout title="Global CRM">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Global CRM</h1>
            <p className="text-muted-foreground mt-1">
              Universal data backbone for all OS Dynasty brands
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Global Contact</DialogTitle>
                </DialogHeader>
                <FullContactForm onSuccess={() => {
                  setShowAddContact(false);
                  queryClient.invalidateQueries({ queryKey: ['global-all-contacts'] });
                }} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="brands" className="gap-2">
              <Building2 className="h-4 w-4" />
              Brand Directory
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              All Contacts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Admin Settings
            </TabsTrigger>
          </TabsList>

          {/* Brand Directory Tab - Global CRM Home */}
          <TabsContent value="brands" className="mt-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search businesses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setActiveTab('settings')} variant="outline" className="ml-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Business
                </Button>
              </div>
            </div>

            {/* Loading State */}
            {(brandsLoading || businessesLoading) ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1,2,3,4,5,6].map(i => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-20 bg-muted rounded" />
                  </Card>
                ))}
              </div>
            ) : (filteredBrands.length === 0 && allBusinesses.length === 0) ? (
              /* Empty State - No businesses found */
              <Card className="p-12 text-center">
                <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Businesses Found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  No businesses have been added to the Global CRM.<br />
                  Add your first business to begin.
                </p>
                <Button onClick={() => setActiveTab('settings')} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Add Business
                </Button>
              </Card>
            ) : (
              /* Brand Cards Grid */
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Show brands from brands table */}
                {filteredBrands.map((brand) => {
                  const stats = brandStats[brand.name] || { storeCount: 0, contactCount: 0 };
                  return (
                    <Card 
                      key={`brand-${brand.id}`} 
                      className="p-6 hover:shadow-lg transition-all cursor-pointer group border-t-4"
                      style={{ borderTopColor: brand.color || 'hsl(var(--primary))' }}
                      onClick={() => navigate(`/grabba/brand/${brand.name.toLowerCase().replace(/\s+/g, '-')}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        {brand.logo_url ? (
                          <img 
                            src={brand.logo_url} 
                            alt={brand.name} 
                            className="w-12 h-12 rounded-lg object-contain"
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: brand.color || 'hsl(var(--primary))' }}
                          >
                            {brand.name.charAt(0)}
                          </div>
                        )}
                        {brand.active === false && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                        {brand.name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Store className="h-4 w-4" />
                          {stats.storeCount} stores
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {stats.contactCount} contacts
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/grabba/brand/${brand.name.toLowerCase().replace(/\s+/g, '-')}`);
                        }}
                      >
                        Open Brand CRM
                      </Button>
                    </Card>
                  );
                })}
                
                {/* Show businesses from businesses table (if different from brands) */}
                {allBusinesses
                  .filter(biz => 
                    !searchTerm || biz.name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .filter(biz => 
                    !filteredBrands.some(b => b.name.toLowerCase() === biz.name?.toLowerCase())
                  )
                  .map((business) => {
                    const stats = brandStats[business.id] || { storeCount: 0, contactCount: 0 };
                    return (
                      <Card 
                        key={`biz-${business.id}`} 
                        className="p-6 hover:shadow-lg transition-all cursor-pointer group border-t-4 border-t-primary/50"
                        onClick={() => navigate(`/crm/brand/${business.id}`)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg bg-primary/80"
                          >
                            {business.name?.charAt(0) || 'B'}
                          </div>
                          <Badge variant="outline">Business</Badge>
                        </div>
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                          {business.name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Store className="h-4 w-4" />
                            {stats.storeCount} stores
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {stats.contactCount} contacts
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/brand/${business.id}`);
                          }}
                        >
                          Open Business CRM
                        </Button>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* All Contacts Tab */}
          <TabsContent value="contacts" className="mt-6">
            {/* Filters */}
            <Card className="p-4 mb-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name, phone, email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={boroughFilter} onValueChange={setBoroughFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Borough" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Boroughs</SelectItem>
                    {boroughs.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.role_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Business" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Businesses</SelectItem>
                    {businesses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Contacts Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Business</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Borough</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contactsLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          Loading contacts...
                        </td>
                      </tr>
                    ) : allContacts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No contacts found. Add your first contact to get started.
                        </td>
                      </tr>
                    ) : (
                      allContacts.map((contact: any) => (
                        <tr key={contact.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">{contact.name}</div>
                            {contact.email && (
                              <div className="text-xs text-muted-foreground">{contact.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {contact.role?.role_name && (
                              <Badge variant="secondary">{contact.role.role_name}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {contact.business?.name && (
                              <Badge variant="outline">{contact.business.name}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm hover:underline">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              {contact.borough?.name || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {contact.notes?.substring(0, 25) || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {contact.updated_at 
                              ? new Date(contact.updated_at).toLocaleDateString() 
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Admin Settings Tab */}
          <TabsContent value="settings" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Manage Businesses/Brands */}
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Manage Brands
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Edit brand names, colors, and status.
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {brands.filter(b => b.active !== false).map((brand) => (
                    <div key={brand.id} className="flex items-center justify-between p-3 rounded-lg border">
                      {editingBrandId === brand.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editBrandName}
                            onChange={(e) => setEditBrandName(e.target.value)}
                            className="h-8"
                          />
                          <input
                            type="color"
                            value={editBrandColor}
                            onChange={(e) => setEditBrandColor(e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveBrand}>
                            <Check className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingBrandId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: brand.color || '#6366f1' }}
                            />
                            <span className="text-sm">{brand.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => handleEditBrand(brand)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => deleteBrandMutation.mutate(brand.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Manage Roles */}
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  Manage Roles
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add or manage universal contact roles.
                </p>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="New role name..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                  />
                  <Button onClick={handleAddRole} disabled={addRole.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      <span>{role.role_name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Manage Geography */}
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Manage Geography
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add boroughs. Neighborhoods are added via contact forms.
                </p>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="New borough name..."
                    value={newBoroughName}
                    onChange={(e) => setNewBoroughName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBorough()}
                  />
                  <Button onClick={handleAddBorough} disabled={addBorough.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {boroughs.map((borough) => (
                    <div key={borough.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{borough.name}</span>
                      </div>
                      <Badge variant="outline">Borough</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
};

export default GlobalCRM;
