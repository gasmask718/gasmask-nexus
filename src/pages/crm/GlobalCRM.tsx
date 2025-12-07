import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, Users, Search, Plus, Settings, MapPin, 
  UserCog, Phone, Mail, Edit, Archive, Eye, Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FullContactForm } from '@/components/crm/FullContactForm';
import { useBoroughs } from '@/hooks/useBoroughs';
import { useCustomerRoles } from '@/hooks/useCustomerRoles';
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

  const { data: boroughs = [] } = useBoroughs();
  const { data: roles = [] } = useCustomerRoles();

  // Fetch all brands
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
      
      // Aggregate store counts
      storeCounts?.forEach((s: any) => {
        const brand = s.brand;
        if (!stats[brand]) stats[brand] = { storeCount: 0, contactCount: 0 };
        stats[brand].storeCount++;
      });
      
      // Aggregate contact counts
      contacts?.forEach((c: any) => {
        const brand = c.brand;
        if (!stats[brand]) stats[brand] = { storeCount: 0, contactCount: 0 };
        stats[brand].contactCount++;
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

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getBrandColor = (brandName: string) => {
    const brand = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
    return brand?.color || '#6366f1';
  };

  const filteredBrands = brands.filter(b => 
    !searchTerm || b.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Admin Settings
            </Button>
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
            <TabsTrigger value="geography" className="gap-2">
              <MapPin className="h-4 w-4" />
              Geography
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <UserCog className="h-4 w-4" />
              Roles
            </TabsTrigger>
          </TabsList>

          {/* Brand Directory Tab */}
          <TabsContent value="brands" className="mt-6">
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {brandsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1,2,3,4].map(i => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-20 bg-muted rounded" />
                  </Card>
                ))}
              </div>
            ) : filteredBrands.length === 0 ? (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Brands Found</h3>
                <p className="text-muted-foreground mb-4">Add brands to get started with the OS Dynasty ecosystem.</p>
                <Button onClick={() => navigate('/settings')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Brand
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredBrands.map((brand) => {
                  const stats = brandStats[brand.name] || { storeCount: 0, contactCount: 0 };
                  return (
                    <Card 
                      key={brand.id} 
                      className="p-6 hover:shadow-lg transition-shadow cursor-pointer group"
                      style={{ borderTopColor: brand.color || '#6366f1', borderTopWidth: '4px' }}
                      onClick={() => navigate(`/brand-crm/${brand.name.toLowerCase().replace(/\s+/g, '-')}`)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: brand.color || '#6366f1' }}
                        >
                          {brand.name.charAt(0)}
                        </div>
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
                          navigate(`/brand-crm/${brand.name.toLowerCase().replace(/\s+/g, '-')}`);
                        }}
                      >
                        Open Brand CRM
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
                      placeholder="Search name, phone, store..."
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
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brands.map((b) => (
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
                      <th className="px-4 py-3 text-left text-sm font-medium">Brand</th>
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
                              {contact.notes || '-'}
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

          {/* Geography Tab */}
          <TabsContent value="geography" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Boroughs
                </h3>
                <div className="space-y-2">
                  {boroughs.map((borough) => (
                    <div key={borough.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <span>{borough.name}</span>
                      <Badge variant="outline">Borough</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Neighborhoods
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Neighborhoods are added via the contact form when you select a borough.
                </p>
                <Button variant="outline" onClick={() => setShowAddContact(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add via Contact Form
                </Button>
              </Card>
            </div>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="mt-6">
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Universal Contact Roles
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                These roles are shared across all brands and populate every contact dropdown.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2 p-3 rounded-lg border">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <span>{role.role_name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
};

export default GlobalCRM;
