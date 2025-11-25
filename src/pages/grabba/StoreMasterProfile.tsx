import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MapPin, DollarSign, Package, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const brandColors = {
  GasMask: { primary: '#D30000', secondary: '#000000' },
  HotMama: { primary: '#B76E79', secondary: '#000000' },
  GrabbaRUs: { primary: '#FFD400', secondary: '#245BFF' },
  HotScalati: { primary: '#5A3A2E', secondary: '#FF7A00' }
};

export default function StoreMasterProfile() {
  const { id } = useParams();

  const { data: storeMaster, isLoading } = useQuery({
    queryKey: ['store-master', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_master')
        .select('*, store_brand_accounts(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: brandAccounts } = useQuery({
    queryKey: ['brand-accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*')
        .eq('store_master_id', id);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  if (!storeMaster) {
    return <div className="text-center p-8">Store not found</div>;
  }

  const totalSpent = brandAccounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{storeMaster.store_name}</h1>
        <p className="text-muted-foreground mt-2">Master Store Profile</p>
      </div>

      {/* Store Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Address</span>
              </div>
              <div className="font-medium">
                {storeMaster.address}<br />
                {storeMaster.city}, {storeMaster.state} {storeMaster.zip}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Phone className="w-4 h-4" />
                <span className="text-sm">Phone</span>
              </div>
              <div className="font-medium">{storeMaster.phone || 'N/A'}</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">Email</span>
              </div>
              <div className="font-medium">{storeMaster.email || 'N/A'}</div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total Spent (All Brands)</span>
              </div>
              <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="GasMask">
            <TabsList className="w-full flex-wrap h-auto">
              {brandAccounts?.map((account) => (
                <TabsTrigger
                  key={account.id}
                  value={account.brand}
                  className="flex-1"
                  style={{
                    borderBottom: `3px solid ${brandColors[account.brand as keyof typeof brandColors].primary}`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: brandColors[account.brand as keyof typeof brandColors].primary }}
                    />
                    {account.brand}
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {brandAccounts?.map((account) => (
              <TabsContent key={account.id} value={account.brand} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card style={{ borderTop: `4px solid ${brandColors[account.brand as keyof typeof brandColors].primary}` }}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Spent</span>
                      </div>
                      <div className="text-2xl font-bold">${Number(account.total_spent || 0).toFixed(2)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loyalty Level</span>
                      </div>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: brandColors[account.brand as keyof typeof brandColors].primary,
                          color: brandColors[account.brand as keyof typeof brandColors].primary
                        }}
                      >
                        {account.loyalty_level}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Credit Terms</span>
                      </div>
                      <div className="font-medium">{account.credit_terms}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted-foreground">Status</span>
                      </div>
                      <Badge variant={account.active_status ? 'default' : 'secondary'}>
                        {account.active_status ? 'Active' : 'Inactive'}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                {/* Brand-Specific Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      No recent orders for {account.brand}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium mb-1">Reorder Prediction</p>
                        <p className="text-xs text-muted-foreground">
                          This store typically orders {account.brand} products every 2 weeks
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium mb-1">Cross-Sell Opportunity</p>
                        <p className="text-xs text-muted-foreground">
                          Consider offering bundle deals with other brands
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button>Send Message</Button>
        <Button variant="outline">Schedule Delivery</Button>
        <Button variant="outline">View History</Button>
      </div>
    </div>
  );
}
