import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Upload, Truck, BarChart3, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const brandColors = {
  GasMask: '#D30000',
  HotMama: '#B76E79',
  GrabbaRUs: '#FFD400',
  HotScalati: '#5A3A2E'
};

export default function GrabbaClusterDashboard() {
  const navigate = useNavigate();

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
            <div className="text-3xl font-bold">247</div>
            <div className="text-sm text-green-600 mt-1">+12 this week</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Brand Accounts</span>
            </div>
            <div className="text-3xl font-bold">589</div>
            <div className="text-sm text-muted-foreground mt-1">Across 4 brands</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Routes</span>
            </div>
            <div className="text-3xl font-bold">12</div>
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
            {Object.entries(brandColors).map(([brand, color]) => (
              <div
                key={brand}
                className="p-4 rounded-lg border"
                style={{ borderTop: `4px solid ${color}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge style={{ backgroundColor: color, color: 'white' }}>
                    {brand}
                  </Badge>
                  <span className="text-2xl font-bold">147</span>
                </div>
                <div className="text-sm text-muted-foreground">Active Accounts</div>
                <div className="text-sm font-medium mt-1">$12.4K revenue</div>
              </div>
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
            >
              <BarChart3 className="w-8 h-8" />
              <div>
                <div className="font-medium">Analytics</div>
                <div className="text-xs text-muted-foreground">Cross-brand insights</div>
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
                  {activity.brands.map((brand) => (
                    <Badge
                      key={brand}
                      variant="outline"
                      style={brand !== 'All' ? {
                        borderColor: brandColors[brand as keyof typeof brandColors],
                        color: brandColors[brand as keyof typeof brandColors]
                      } : {}}
                    >
                      {brand}
                    </Badge>
                  ))}
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
