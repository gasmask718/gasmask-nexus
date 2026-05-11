import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, 
  Package, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  MapPin,
  Phone,
  Clock,
  AlertTriangle,
  Upload,
  PenLine
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCall } from '@/components/communication/CallProvider';
import { DeliveryTaskCard } from '@/components/delivery/DeliveryTaskCard';
import { DeliveryStopIntelligenceCards } from '@/components/delivery/DeliveryStopIntelligenceCards';

interface DeliveryItem {
  id: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  confirmed: boolean;
}

interface DeliveryStop {
  id: string;
  store_id: string;
  store_name: string;
  address: string;
  phone: string;
  status: 'pending' | 'arrived' | 'in_progress' | 'completed' | 'failed';
  items: DeliveryItem[];
  instructions: string;
}

interface MakeDeliveryPageProps {
  portalType: 'driver' | 'biker';
}

export function MakeDeliveryPage({ portalType }: MakeDeliveryPageProps) {
  const params = useParams<{ stopId?: string; deliveryId?: string }>();
  const stopId = params.stopId ?? params.deliveryId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { initiateCall } = useCall();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stop, setStop] = useState<DeliveryStop | null>(null);
  const [notes, setNotes] = useState('');
  const [failReason, setFailReason] = useState('');
  const [podType, setPodType] = useState<'photo' | 'signature' | 'pin' | null>(null);
  const [podValue, setPodValue] = useState('');
  const [allItemsConfirmed, setAllItemsConfirmed] = useState(false);

  useEffect(() => {
    async function fetchDeliveryData() {
      if (!stopId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch route stop data
        const { data: routeStop } = await supabase
          .from('route_stops')
          .select(`
            id,
            status,
            store_id,
            stores:store_id (name, address_street, address_city, boro, phone)
          `)
          .eq('id', stopId)
          .single();

        if (routeStop) {
          // For demo, create sample items - in production, fetch from actual delivery orders
          const sampleItems: DeliveryItem[] = [
            { id: '1', product_name: 'Grabba Leaf (Light)', brand_name: 'Grabba', quantity: 5, confirmed: false },
            { id: '2', product_name: 'Hot Scolatti Dark', brand_name: 'Hot Scolatti', quantity: 10, confirmed: false },
            { id: '3', product_name: 'Rolling Papers', brand_name: 'Accessories', quantity: 20, confirmed: false },
          ];

          const s = (routeStop.stores as any) || {};
          setStop({
            id: routeStop.id,
            store_id: routeStop.store_id,
            store_name: s.name || 'Unknown Store',
            address: [s.address_street, s.address_city, s.boro].filter(Boolean).join(', '),
            phone: s.phone || '',
            status: (routeStop.status as DeliveryStop['status']) || 'pending',
            items: sampleItems,
            instructions: '',
          });
        }
      } catch (error) {
        console.error('Error fetching delivery data:', error);
        toast({
          title: 'Error loading delivery',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDeliveryData();
  }, [stopId, toast]);

  const handleConfirmItem = (itemId: string) => {
    if (!stop) return;
    const updatedItems = stop.items.map(item =>
      item.id === itemId ? { ...item, confirmed: !item.confirmed } : item
    );
    setStop({ ...stop, items: updatedItems });
    setAllItemsConfirmed(updatedItems.every(item => item.confirmed));
  };

  const handleConfirmArrival = async () => {
    if (!stop) return;
    setSubmitting(true);
    try {
      await supabase
        .from('route_stops')
        .update({ status: 'arrived' })
        .eq('id', stop.id);

      setStop({ ...stop, status: 'arrived' });
      toast({ title: 'Arrival confirmed' });
    } catch (error) {
      console.error('Error confirming arrival:', error);
      toast({ title: 'Failed to confirm arrival', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!stop || !podType) {
      toast({ title: 'Proof of Delivery required', description: 'Please provide photo, signature, or PIN confirmation.', variant: 'destructive' });
      return;
    }
    if (!allItemsConfirmed) {
      toast({ title: 'Confirm all items first', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update route stop
      await supabase
        .from('route_stops')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          notes: notes 
        })
        .eq('id', stop.id);

      // Create store visit record
      await supabase
        .from('store_visits')
        .insert({
          store_id: stop.store_id,
          visited_by: user.id,
          role_type: 'driver',
          visit_type: 'delivery',
          status: 'completed',
          notes: `Delivery completed. POD: ${podType}. ${notes}`,
        });

      toast({ title: 'Delivery completed successfully!' });
      navigate('/portal/driver');
    } catch (error) {
      console.error('Error completing delivery:', error);
      toast({ title: 'Failed to complete delivery', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFailDelivery = async () => {
    if (!stop || !failReason) {
      toast({ title: 'Please provide a reason', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('route_stops')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          notes: `FAILED: ${failReason}` 
        })
        .eq('id', stop.id);

      await supabase
        .from('store_visits')
        .insert({
          store_id: stop.store_id,
          visited_by: user.id,
          role_type: 'driver',
          visit_type: 'delivery',
          status: 'failed',
          notes: `Delivery failed: ${failReason}`,
        });

      toast({ title: 'Delivery marked as failed' });
      navigate('/portal/driver');
    } catch (error) {
      console.error('Error failing delivery:', error);
      toast({ title: 'Failed to update delivery', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stop && !stopId) {
    // No specific stop - show available deliveries
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">Make Delivery</h1>
          <p className="text-sm text-muted-foreground">Select a stop from your route to start delivery</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No active delivery selected</p>
            <Button onClick={() => navigate('/portal/driver/stores')}>
              View Stops
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stop) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Delivery not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{stop.store_name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {stop.address}
            </p>
          </div>
        </div>
        <Badge variant={stop.status === 'completed' ? 'default' : 'secondary'} className="uppercase">
          {stop.status}
        </Badge>
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Delivery Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${stop.status !== 'pending' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">Assigned</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-2 ${['arrived', 'in_progress', 'completed'].includes(stop.status) ? 'text-green-600' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">Arrived</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-2 ${stop.status === 'completed' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">Completed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Arrival */}
      {stop.status === 'pending' && (
        <Card className="border-hud-cyan/30 bg-hud-cyan/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Confirm your arrival</p>
                <p className="text-sm text-muted-foreground">Mark that you've arrived at the store</p>
              </div>
              <Button onClick={handleConfirmArrival} disabled={submitting}>
                Confirm Arrival
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Store Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{stop.phone || 'No phone listed'}</span>
            </div>
            {stop.phone && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => initiateCall({
                  destinationPhone: stop.phone,
                  entityType: 'store',
                  entityId: stop.store_id,
                  entityName: stop.store_name
                })}
              >
                Call Store
              </Button>
            )}
          </div>
          {stop.instructions && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Delivery Instructions:</p>
              <p className="text-sm mt-1">{stop.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-stop intelligence cards (Step 7) */}
      <DeliveryStopIntelligenceCards storeId={stop.store_id} routeStopId={stop.id} />

      {/* Delivery Task Checklist — shown after arrival */}
      {stop.status !== 'pending' && (
        <>
          <Separator />
          <DeliveryTaskCard 
            storeId={stop.store_id} 
            storeName={stop.store_name}
          />
          <Separator />
        </>
      )}

      {/* Items to Deliver */}
      {stop.status !== 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items to Deliver
            </CardTitle>
            <CardDescription>Confirm each item as delivered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stop.items.map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    item.confirmed ? 'border-green-500/30 bg-green-500/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleConfirmItem(item.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.confirmed ? 'bg-green-500/20 text-green-500' : 'bg-muted'
                    }`}>
                      {item.confirmed ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.brand_name}</p>
                    </div>
                  </div>
                  <Badge variant="outline">x{item.quantity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proof of Delivery */}
      {stop.status !== 'pending' && stop.status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proof of Delivery
            </CardTitle>
            <CardDescription>Required: Provide at least one form of proof</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant={podType === 'photo' ? 'default' : 'outline'} 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setPodType('photo')}
              >
                <Upload className="h-5 w-5" />
                <span className="text-xs">Photo</span>
              </Button>
              <Button 
                variant={podType === 'signature' ? 'default' : 'outline'} 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setPodType('signature')}
              >
                <PenLine className="h-5 w-5" />
                <span className="text-xs">Signature</span>
              </Button>
              <Button 
                variant={podType === 'pin' ? 'default' : 'outline'} 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setPodType('pin')}
              >
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs">PIN</span>
              </Button>
            </div>
            {podType === 'pin' && (
              <div className="space-y-2">
                <Label>Store PIN</Label>
                <Input 
                  placeholder="Enter store confirmation PIN"
                  value={podValue}
                  onChange={(e) => setPodValue(e.target.value)}
                />
              </div>
            )}
            {podType === 'photo' && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Tap to upload delivery photo</p>
              </div>
            )}
            {podType === 'signature' && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30">
                <PenLine className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Tap for signature capture</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {stop.status !== 'pending' && stop.status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Add any notes about this delivery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Complete or Fail */}
      {stop.status !== 'pending' && stop.status !== 'completed' && stop.status !== 'failed' && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-destructive/30">
            <CardContent className="py-4">
              <div className="space-y-3">
                <Textarea 
                  placeholder="Reason for failed delivery..."
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <Button 
                  variant="destructive" 
                  className="w-full gap-2"
                  onClick={handleFailDelivery}
                  disabled={submitting || !failReason}
                >
                  <XCircle className="h-4 w-4" />
                  Fail Delivery
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="py-4">
              <div className="space-y-3">
                <div className="text-center">
                  <p className="font-medium text-green-600">Ready to complete?</p>
                  <p className="text-xs text-muted-foreground">
                    {allItemsConfirmed ? '✓ Items confirmed' : 'Confirm all items first'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {podType ? `✓ POD: ${podType}` : 'Select POD type'}
                  </p>
                </div>
                <Button 
                  className="w-full gap-2"
                  onClick={handleCompleteDelivery}
                  disabled={submitting || !allItemsConfirmed || !podType}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete Delivery
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Already Completed */}
      {stop.status === 'completed' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <p className="font-medium text-green-600">Delivery Completed</p>
          </CardContent>
        </Card>
      )}

      {stop.status === 'failed' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-6 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-2" />
            <p className="font-medium text-destructive">Delivery Failed</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
