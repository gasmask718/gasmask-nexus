import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Upload, Truck, BarChart3, Users, MessageSquare, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const brandColors = {
  GasMask: { primary: '#D30000', secondary: '#000000', name: 'GasMask' },
  HotMama: { primary: '#B76E79', secondary: '#000000', name: 'HotMama' },
  GrabbaRUs: { primary: '#FFD400', secondary: '#245BFF', name: 'Grabba R Us' },
  HotScalati: { primary: '#5A3A2E', secondary: '#FF7A00', name: 'Hot Scalati' }
};

export default function GrabbaClusterDashboard() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['grabba-stats'],
    queryFn: async () => {
      const [storesRes, accountsRes, routesRes] = await Promise.all([
        supabase.from('store_master').select('id', { count: 'exact' }),
        supabase.from('store_brand_accounts').select('id, brand', { count: 'exact' }),
        supabase.from('biker_routes').select('id').eq('route_date', new Date().toISOString().split('T')[0])
      ]);

      const brandCounts = accountsRes.data?.reduce((acc: any, account) => {
        acc[account.brand] = (acc[account.brand] || 0) + 1;
        return acc;
      }, {});

      return {
        totalStores: storesRes.count || 0,
        totalAccounts: accountsRes.count || 0,
        activeRoutes: routesRes.data?.length || 0,
        brandCounts: brandCounts || {}
      };
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Grabba Cluster Operations</h1>
        <p className="text-muted-foreground mt-2">
          Unified multi-brand management system for GasMask • HotMama • Grabba R Us • Hot Scalati
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Stores</span>
            </div>
            <div className="text-3xl font-bold">{stats?.totalStores || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Total locations</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Brand Accounts</span>
            </div>
            <div className="text-3xl font-bold">{stats?.totalAccounts || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Across 4 brands</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Routes</span>
            </div>
            <div className="text-3xl font-bold">{stats?.activeRoutes || 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Today</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <div className="text-3xl font-bold">$45.2K</div>
            <div className="text-sm text-green-600 mt-1">This month</div>
          </CardContent>
        </Card>
      </div>

      {/* Brand Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(brandColors).map(([brand, config]) => (
              <Button
                key={brand}
                variant="outline"
                className="p-6 h-auto flex-col items-start gap-3 hover:shadow-lg transition-shadow"
                style={{ borderTop: `4px solid ${config.primary}` }}
                onClick={() => navigate(`/grabba/brand/${brand.toLowerCase()}`)}
              >
                <div className="flex items-center justify-between w-full">
                  <Badge style={{ backgroundColor: config.primary, color: 'white' }}>
                    {config.name}
                  </Badge>
                  <span className="text-2xl font-bold">{stats?.brandCounts?.[brand] || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground text-left w-full">Active Accounts</div>
                <div className="flex gap-2 w-full">
                  <MessageSquare className="w-4 h-4" style={{ color: config.primary }} />
                  <Brain className="w-4 h-4" style={{ color: config.secondary }} />
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/unified-upload')}
            >
              <Upload className="w-8 h-8" />
              <div>
                <div className="font-medium">Unified Upload</div>
                <div className="text-xs text-muted-foreground">Upload CSV for all brands</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/delivery-runs')}
            >
              <Truck className="w-8 h-8" />
              <div>
                <div className="font-medium">Delivery Runs</div>
                <div className="text-xs text-muted-foreground">View multi-brand routes</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/analytics')}
            >
              <BarChart3 className="w-8 h-8" />
              <div>
                <div className="font-medium">Analytics</div>
                <div className="text-xs text-muted-foreground">Cross-brand insights</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/communications')}
            >
              <MessageSquare className="w-8 h-8" />
              <div>
                <div className="font-medium">Communications</div>
                <div className="text-xs text-muted-foreground">Brand messaging</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/grabba/ai-insights')}
            >
              <Brain className="w-8 h-8" />
              <div>
                <div className="font-medium">AI Insights</div>
                <div className="text-xs text-muted-foreground">Smart analytics</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: 'New store added', store: '282 Nostrand Ave', brands: ['GasMask', 'HotMama'], time: '5 min ago' },
              { action: 'CSV uploaded', store: 'grabba_batch_jan_12.csv', brands: ['All'], time: '1 hour ago' },
              { action: 'Delivery completed', store: 'Brooklyn Smoke Shop', brands: ['GasMask', 'GrabbaRUs'], time: '2 hours ago' }
            ].map((activity, i) => (
              <div key={i} className="p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <div className="font-medium">{activity.action}</div>
                  <div className="text-sm text-muted-foreground">{activity.store}</div>
                </div>
                <div className="flex items-center gap-2">
                  {activity.brands.map((brand) => {
                    const brandConfig = brandColors[brand as keyof typeof brandColors];
                    return (
                      <Badge
                        key={brand}
                        variant="outline"
                        style={brand !== 'All' && brandConfig ? {
                          borderColor: brandConfig.primary,
                          color: brandConfig.primary
                        } : {}}
                      >
                        {brand}
                      </Badge>
                    );
                  })}
                  <span className="text-xs text-muted-foreground ml-2">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
