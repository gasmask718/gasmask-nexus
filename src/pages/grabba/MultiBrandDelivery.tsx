import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, MapPin, Package, CheckCircle, Phone, Navigation, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GRABBA_BRAND_CONFIG } from '@/config/grabbaSkyscraper';

// Use correct brand colors from config
const brandColors = {
  GasMask: GRABBA_BRAND_CONFIG.gasmask.primary, // Red
  HotMama: GRABBA_BRAND_CONFIG.hotmama.primary, // Rose-gold pink
  GrabbaRUs: GRABBA_BRAND_CONFIG.grabba.primary, // Purple
  HotScalati: GRABBA_BRAND_CONFIG.scalati.primary // Orange
};

export default function MultiBrandDelivery() {
  const [completedStops, setCompletedStops] = useState<Set<number>>(new Set());
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<{ name: string; address: string; phone?: string } | null>(null);

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
      id: 0,
      storeName: '282 Nostrand Ave',
      address: '282 Nostrand Ave, Brooklyn, NY',
      phone: '(718) 555-0123',
      brands: [
        { brand: 'GasMask', boxes: 2, product: 'Premium Tubes' },
        { brand: 'HotMama', boxes: 1, product: 'Rose Gold Edition' },
        { brand: 'HotScalati', boxes: 1, product: 'Fire Orange' },
        { brand: 'GrabbaRUs', boxes: 1, product: 'Classic Mix' }
      ],
      totalBoxes: 5,
    },
    {
      id: 1,
      storeName: 'Brooklyn Smoke Shop',
      address: '445 Flatbush Ave, Brooklyn, NY',
      phone: '(718) 555-0456',
      brands: [
        { brand: 'GasMask', boxes: 3, product: 'Street Lux' },
        { brand: 'GrabbaRUs', boxes: 2, product: 'Bodega Special' }
      ],
      totalBoxes: 5,
    },
    {
      id: 2,
      storeName: 'Corner Deli',
      address: '89 Bedford Ave, Brooklyn, NY',
      phone: '(718) 555-0789',
      brands: [
        { brand: 'HotMama', boxes: 2, product: 'Luxury Line' },
        { brand: 'HotScalati', boxes: 1, product: 'Chocolate Fire' }
      ],
      totalBoxes: 3,
    }
  ];

  // Handlers for delivery actions
  const handleMarkComplete = (stopId: number, storeName: string) => {
    console.log('[GRABBA MULTI-RUN] Mark Complete clicked', { stopId, storeName });
    setCompletedStops(prev => new Set([...prev, stopId]));
    toast.success(`Delivery to ${storeName} marked as complete`);
  };

  const handleCallStore = (stop: typeof deliveryStops[0]) => {
    console.log('[GRABBA MULTI-RUN] Call Store clicked', { store: stop.storeName, phone: stop.phone });
    setSelectedStore({ name: stop.storeName, address: stop.address, phone: stop.phone });
    setCallModalOpen(true);
  };

  const handleNavigate = (address: string) => {
    console.log('[GRABBA MULTI-RUN] Navigate clicked', { address });
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
    toast.success('Opening Google Maps...');
  };

  const getStopStatus = (stopId: number) => completedStops.has(stopId) ? 'completed' : 'pending';

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
        {deliveryStops.map((stop, i) => {
          const status = getStopStatus(stop.id);
          return (
            <Card key={stop.id} className={status === 'completed' ? 'opacity-75' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      status === 'completed' ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
                    }`}>
                      {status === 'completed' ? <CheckCircle className="w-5 h-5" /> : i + 1}
                    </div>
                    <div>
                      <div className="text-lg">{stop.storeName}</div>
                      <div className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {stop.address}
                      </div>
                    </div>
                  </div>
                  <Badge variant={status === 'completed' ? 'default' : 'outline'} className={status === 'completed' ? 'bg-green-600' : ''}>
                    {status === 'completed' ? (
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
                    {status === 'pending' && (
                      <>
                        <Button size="sm" variant="default" onClick={() => handleMarkComplete(stop.id, stop.storeName)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Complete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCallStore(stop)}>
                          <Phone className="w-4 h-4 mr-2" />
                          Call Store
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleNavigate(stop.address)}>
                          <Navigation className="w-4 h-4 mr-2" />
                          Navigate
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Call Store Modal */}
      <Dialog open={callModalOpen} onOpenChange={setCallModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call Store</DialogTitle>
          </DialogHeader>
          {selectedStore && (
            <div className="space-y-4">
              <div>
                <div className="font-medium text-lg">{selectedStore.name}</div>
                <div className="text-sm text-muted-foreground">{selectedStore.address}</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Phone Number</div>
                <div className="text-2xl font-bold">{selectedStore.phone || 'Not available'}</div>
              </div>
              {selectedStore.phone && (
                <Button className="w-full" onClick={() => {
                  window.open(`tel:${selectedStore.phone}`, '_self');
                  toast.success('Initiating call...');
                }}>
                  <Phone className="w-4 h-4 mr-2" />
                  Call {selectedStore.phone}
                </Button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Full telephony integration coming soon
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
