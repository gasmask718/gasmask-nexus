import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Store, Users, DollarSign, QrCode, FileText, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PortalAmbassador() {
  const [ambassadorData, setAmbassadorData] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAmbassadorData();
  }, []);

  async function fetchAmbassadorData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Simplified queries to avoid type issues
      const ambassadorResponse: any = await supabase
        .from('ambassadors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (ambassadorResponse.data) {
        setAmbassadorData(ambassadorResponse.data);

        const commissionsResponse: any = await supabase
          .from('ambassador_commissions')
          .select('*')
          .eq('ambassador_id', ambassadorResponse.data.id)
          .order('created_at', { ascending: false });

        setCommissions(commissionsResponse.data || []);

        const linksResponse: any = await supabase
          .from('ambassador_links')
          .select('*')
          .eq('ambassador_id', ambassadorResponse.data.id);

        setLinks(linksResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching ambassador data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ambassador data',
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

  if (!ambassadorData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Ambassador Profile Not Found</h2>
          <p className="text-muted-foreground mb-6">
            Apply to become a GasMask Ambassador
          </p>
          <Button>Apply Now</Button>
        </Card>
      </div>
    );
  }

  const totalEarnings = ambassadorData.total_earnings || 0;
  const pendingCommissions = commissions.filter(c => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Ambassador Portal</h1>
              <p className="text-muted-foreground">Code: {ambassadorData.tracking_code}</p>
            </div>
            <Badge variant={ambassadorData.is_active ? 'default' : 'secondary'}>
              {ambassadorData.tier} Tier
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="links">Affiliate Links</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-4">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold">${totalEarnings.toFixed(2)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Store className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Stores Referred</p>
                    <p className="text-2xl font-bold">{links.filter(l => l.entity_type === 'store').length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wholesalers</p>
                    <p className="text-2xl font-bold">{links.filter(l => l.entity_type === 'wholesale').length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{pendingCommissions}</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Button className="w-full">
                  <Link2 className="mr-2 h-4 w-4" />
                  Generate Affiliate Link
                </Button>
                <Button variant="outline" className="w-full">
                  <QrCode className="mr-2 h-4 w-4" />
                  Get QR Code
                </Button>
                <Button variant="outline" className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  View Scripts
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Commissions</h3>
              {commissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No commissions yet</p>
              ) : (
                <div className="space-y-2">
                  {commissions.slice(0, 5).map((comm) => (
                    <div key={comm.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">${comm.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {comm.entity_type} • {new Date(comm.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                        {comm.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="links">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Your Affiliate Links</h3>
              <p className="text-muted-foreground mb-4">
                Share these links to earn commissions on signups
              </p>
              <Button>
                <Link2 className="mr-2 h-4 w-4" />
                Create New Link
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Referral Network</h3>
              <p className="text-muted-foreground">Track stores and wholesalers you've referred</p>
            </Card>
          </TabsContent>

          <TabsContent value="commissions">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Commission History</h3>
              {commissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No commissions yet</p>
              ) : (
                <div className="space-y-2">
                  {commissions.map((comm) => (
                    <div key={comm.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">${comm.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {comm.entity_type} • {new Date(comm.created_at).toLocaleDateString()}
                        </p>
                        {comm.notes && <p className="text-sm text-muted-foreground mt-1">{comm.notes}</p>}
                      </div>
                      <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                        {comm.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="resources">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Ambassador Resources</h3>
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Outreach Scripts
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <QrCode className="mr-2 h-4 w-4" />
                  Download QR Codes
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Package className="mr-2 h-4 w-4" />
                  Store Onboarding Kit
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Settings</h3>
              <p className="text-muted-foreground">Update your ambassador profile</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
