import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, MapPin, Package, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const brandColors = {
  GasMask: '#D30000',
  HotMama: '#B76E79',
  GrabbaRUs: '#FFD400',
  HotScalati: '#5A3A2E'
};

export default function MultiBrandDelivery() {
  const { data: routes, isLoading } = useQuery({
    queryKey: ['biker-routes-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('biker_routes')
        .select('*, store_master(*)')
        .eq('route_date', today);
      
      if (error) throw error;
      return data;
    }
  });

  // Mock delivery data with multiple brands per stop
  const deliveryStops = [
    {
      storeName: '282 Nostrand Ave',
      address: '282 Nostrand Ave, Brooklyn, NY',
      brands: [
        { brand: 'GasMask', boxes: 2, product: 'Premium Tubes' },
        { brand: 'HotMama', boxes: 1, product: 'Rose Gold Edition' },
        { brand: 'HotScalati', boxes: 1, product: 'Fire Orange' },
        { brand: 'GrabbaRUs', boxes: 1, product: 'Classic Mix' }
      ],
      totalBoxes: 5,
      status: 'pending'
    },
    {
      storeName: 'Brooklyn Smoke Shop',
      address: '445 Flatbush Ave, Brooklyn, NY',
      brands: [
        { brand: 'GasMask', boxes: 3, product: 'Street Lux' },
        { brand: 'GrabbaRUs', boxes: 2, product: 'Bodega Special' }
      ],
      totalBoxes: 5,
      status: 'pending'
    },
    {
      storeName: 'Corner Deli',
      address: '89 Bedford Ave, Brooklyn, NY',
      brands: [
        { brand: 'HotMama', boxes: 2, product: 'Luxury Line' },
        { brand: 'HotScalati', boxes: 1, product: 'Chocolate Fire' }
      ],
      totalBoxes: 3,
      status: 'completed'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Brand Delivery Runs</h1>
        <p className="text-muted-foreground mt-2">
          Today's deliveries optimized by stop • Each store receives all 4 brands in one visit
        </p>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">12</div>
            <div className="text-sm text-muted-foreground">Total Stops</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">48</div>
            <div className="text-sm text-muted-foreground">Total Boxes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">4</div>
            <div className="text-sm text-muted-foreground">Active Bikers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">75%</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Delivery Map View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Route Optimization Map
            </span>
            <Button variant="outline" size="sm">
              <Truck className="w-4 h-4 mr-2" />
              Optimize Route
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-lg bg-muted flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Map View - Cluster Route Visualization</p>
              <p className="text-sm text-muted-foreground mt-1">Shows optimized stops by proximity</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Stops */}
      <div className="space-y-4">
        {deliveryStops.map((stop, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-lg">{stop.storeName}</div>
                    <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {stop.address}
                    </div>
                  </div>
                </div>
                <Badge variant={stop.status === 'completed' ? 'default' : 'outline'}>
                  {stop.status === 'completed' ? (
                    <><CheckCircle className="w-3 h-3 mr-1" /> Completed</>
                  ) : (
                    'Pending'
                  )}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">Total: {stop.totalBoxes} boxes</span>
                  </div>
                  <span className="text-sm text-muted-foreground">1 stop • Multiple brands</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stop.brands.map((item, j) => (
                    <div
                      key={j}
                      className="p-4 rounded-lg border"
                      style={{ borderLeft: `4px solid ${brandColors[item.brand as keyof typeof brandColors]}` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          style={{
                            backgroundColor: brandColors[item.brand as keyof typeof brandColors],
                            color: 'white'
                          }}
                        >
                          {item.brand}
                        </Badge>
                        <span className="font-bold">{item.boxes} boxes</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.product}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {stop.status === 'pending' && (
                    <>
                      <Button size="sm" variant="default">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Complete
                      </Button>
                      <Button size="sm" variant="outline">
                        Call Store
                      </Button>
                      <Button size="sm" variant="outline">
                        Navigate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Delivery Notes */}
      <Card>
        <CardHeader>
          <CardTitle>AI Route Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium">Optimal Route Order</p>
              <p className="text-xs text-muted-foreground mt-1">
                Follow suggested sequence to save 15 minutes and reduce 3.2 miles
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium">Multi-Brand Efficiency</p>
              <p className="text-xs text-muted-foreground mt-1">
                Delivering all 4 brands per stop reduces total delivery time by 40%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
