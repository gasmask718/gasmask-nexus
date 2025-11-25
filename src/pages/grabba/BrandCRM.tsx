import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Phone, Mail, MessageSquare, Plus, Filter, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const brandColors = {
  gasmask: { primary: '#D30000', secondary: '#000000', name: 'GasMask' },
  hotmama: { primary: '#B76E79', secondary: '#000000', name: 'HotMama' },
  grabbarus: { primary: '#FFD400', secondary: '#245BFF', name: 'Grabba R Us' },
  hotscalati: { primary: '#5A3A2E', secondary: '#FF7A00', name: 'Hot Scalati' }
};

export default function BrandCRM() {
  const { brand } = useParams();
  const navigate = useNavigate();
  const brandConfig = brand ? brandColors[brand as keyof typeof brandColors] : null;

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['brand-accounts', brand],
    queryFn: async () => {
      if (!brand || !brandConfig) return [];
      
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*, store_master(*)')
        .eq('brand', brandConfig.name as any);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: contacts } = useQuery({
    queryKey: ['brand-contacts', brand],
    queryFn: async () => {
      if (!brand || !brandConfig) return [];
      
      const { data, error } = await supabase
        .from('brand_crm_contacts')
        .select('*')
        .eq('brand', brandConfig.name as any);
      
      if (error) throw error;
      return data;
    }
  });

  if (!brandConfig) {
    return <div className="p-8 text-center">Brand not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: brandConfig.primary }}>
            {brandConfig.name} CRM
          </h1>
          <p className="text-muted-foreground mt-2">
            Brand-isolated customer relationship management
          </p>
        </div>
        <Button style={{ backgroundColor: brandConfig.primary, color: 'white' }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card style={{ borderTop: `4px solid ${brandConfig.primary}` }}>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{accounts?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Active Stores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{contacts?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total Contacts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">
              ${accounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0).toFixed(0)}
            </div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">
              {accounts?.filter(a => a.active_status).length || 0}
            </div>
            <div className="text-sm text-muted-foreground">Active This Month</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search stores, contacts..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stores">
        <TabsList>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : accounts && accounts.length > 0 ? (
            accounts.map((account) => (
              <Card 
                key={account.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/grabba/store-master/${account.store_master_id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{account.store_master?.store_name}</h3>
                        <Badge
                          style={{
                            backgroundColor: account.active_status ? brandConfig.primary : undefined,
                            color: account.active_status ? 'white' : undefined
                          }}
                          variant={account.active_status ? 'default' : 'outline'}
                        >
                          {account.loyalty_level}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.store_master?.address}, {account.store_master?.city}
                      </div>
                      <div className="flex gap-4 mt-3">
                        <span className="text-sm">
                          <strong>${Number(account.total_spent || 0).toFixed(2)}</strong> total
                        </span>
                        <span className="text-sm">{account.credit_terms}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No stores found for {brandConfig.name}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3">
          {contacts && contacts.length > 0 ? (
            contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{contact.contact_name}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        {contact.contact_phone} • {contact.contact_email}
                      </div>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {contact.tags.map((tag, i) => (
                            <Badge key={i} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No contacts found
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: brandConfig.primary }} />
                AI-Powered Insights for {brandConfig.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${brandConfig.primary}15`, borderLeft: `4px solid ${brandConfig.primary}` }}>
                <p className="font-medium mb-1">Top Performing Segment</p>
                <p className="text-sm text-muted-foreground">
                  VIP tier stores generate 65% of revenue. Consider upgrading Gold tier stores.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium mb-1">Reorder Opportunity</p>
                <p className="text-sm text-muted-foreground">
                  12 stores haven't ordered in 30+ days. Suggested outreach this week.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium mb-1">Cross-Brand Potential</p>
                <p className="text-sm text-muted-foreground">
                  8 {brandConfig.name} stores also buy from other brands. Bundle opportunity.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
