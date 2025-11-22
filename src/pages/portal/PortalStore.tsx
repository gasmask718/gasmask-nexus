import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Package, MessageSquare, Award, FileText, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PortalStore() {
  const [storeData, setStoreData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStoreData();
  }, []);

  async function fetchStoreData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: storeData } = await supabase
        .from('stores')
        .select('id, name, address_street, address_city, address_state, address_zip, status, type, created_at, owner_user_id')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (storeData) {
        setStoreData(storeData);

        const { data: ordersData } = await supabase
          .from('wholesale_orders')
          .select('id, created_at, status, store_id')
          .eq('store_id', storeData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setOrders(ordersData || []);
      }
    } catch (error) {
      console.error('Error fetching store data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load store data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Store Found</h2>
          <p className="text-muted-foreground mb-6">
            Your account is not linked to a store. Please contact support to get access.
          </p>
          <Button onClick={() => window.location.href = 'mailto:support@gasmask.com'}>
            Contact Support
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{storeData.name}</h1>
              <p className="text-muted-foreground">{storeData.address_street}, {storeData.address_city}</p>
            </div>
            <Badge variant={storeData.status === 'active' ? 'default' : 'secondary'}>
              {storeData.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Recent Orders</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Award className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reward Points</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Messages</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Button className="w-full">
                  <Package className="mr-2 h-4 w-4" />
                  Place New Order
                </Button>
                <Button variant="outline" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message Your Rep
                </Button>
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  View Invoices
                </Button>
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Update Profile
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Order History</h3>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{order.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Inventory Recommendations</h3>
              <p className="text-muted-foreground">AI-powered restock suggestions will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Messages</h3>
              <p className="text-muted-foreground">Your messages will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="rewards">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Rewards Program</h3>
              <p className="text-muted-foreground">Earn points with every order</p>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Invoices & Billing</h3>
              <p className="text-muted-foreground">Your invoices will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Store Settings</h3>
              <p className="text-muted-foreground">Update your store information</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
