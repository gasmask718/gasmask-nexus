import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { useDeliveryWithStops, useUpdateDelivery, useUpdateStop, useCreateStop, useLocations, useCreateProof, type DeliveryStop } from "@/hooks/useDeliveryData";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Phone,
  Navigation,
  Camera,
  Plus,
  Truck,
  Package,
  DollarSign,
  Play
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STOP_STATUSES = ["pending", "en_route", "arrived", "completed", "failed", "skipped"];
const STOP_TYPES = ["pickup", "dropoff", "checkin", "other"];

export default function MyRoute() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  // If no deliveryId, show route selector
  const { data: availableRoutes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['available-routes', businessId],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('deliveries')
        .select(`*, delivery_stops(count)`)
        .eq('scheduled_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !deliveryId && !!businessId
  });

  const { data: delivery, isLoading } = useDeliveryWithStops(deliveryId);
  const { data: locations = [] } = useLocations(businessId);
  const updateDelivery = useUpdateDelivery();
  const updateStop = useUpdateStop();
  const createStop = useCreateStop();
  const createProof = useCreateProof();

  const [selectedStop, setSelectedStop] = useState<DeliveryStop | null>(null);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [stopForm, setStopForm] = useState({
    location_id: "",
    stop_type: "dropoff",
    items_summary: "",
    amount_due: "",
  });
  const [driverNotes, setDriverNotes] = useState("");
  const [amountCollected, setAmountCollected] = useState("");
  const [proofNote, setProofNote] = useState("");

  // Route Selector View
  if (!deliveryId) {
    return (
      <Layout>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/delivery/driver-home')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Select Route</h1>
              <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>

          {loadingRoutes ? (
            <div className="text-center py-8 text-muted-foreground">Loading routes...</div>
          ) : availableRoutes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Routes Today</h2>
                <p className="text-muted-foreground mb-4">You have no routes scheduled for today.</p>
                <Button onClick={() => navigate('/delivery/driver-home')}>
                  Back to Driver Home
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {availableRoutes.map((route: any) => {
                const stopCount = route.delivery_stops?.[0]?.count || 0;
                return (
                  <Card 
                    key={route.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/delivery/my-route/${route.id}`)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-lg">
                              {route.delivery_type?.replace('_', ' ').toUpperCase() || 'Delivery'}
                            </p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" /> {stopCount} stops
                              </span>
                              <Badge variant={route.status === 'in_progress' ? 'default' : 'secondary'}>
                                {route.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button>
                          {route.status === 'in_progress' ? (
                            <>
                              <Navigation className="h-4 w-4 mr-2" /> Continue
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" /> Start
                            </>
                          )}
                        </Button>
                      </div>
                      {route.dispatcher_notes && (
                        <p className="text-sm text-muted-foreground mt-3 p-2 bg-muted rounded">
                          {route.dispatcher_notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 text-center">Loading...</div>
      </Layout>
    );
  }

  if (!delivery) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Delivery not found</p>
          <Button onClick={() => navigate('/delivery/my-route')}>View All Routes</Button>
        </div>
      </Layout>
    );
  }

  const stops = delivery.stops || [];
  const completedStops = stops.filter(s => s.status === "completed" || s.status === "failed" || s.status === "skipped");
  const remainingStops = stops.filter(s => s.status === "pending" || s.status === "en_route" || s.status === "arrived");

  const handleStartRoute = async () => {
    await updateDelivery.mutateAsync({ id: delivery.id, status: "in_progress" });
    toast.success("Route started!");
  };

  const handleCompleteRoute = async () => {
    if (remainingStops.length > 0) {
      toast.error("Complete all stops before finishing the route");
      return;
    }
    await updateDelivery.mutateAsync({ id: delivery.id, status: "completed" });
    toast.success("Route completed!");
    navigate("/delivery");
  };

  const handleStopStatusChange = async (stop: DeliveryStop, newStatus: string) => {
    if (!businessId) return;
    
    const updates: Partial<DeliveryStop> & { id: string; businessId: string } = {
      id: stop.id,
      businessId,
      status: newStatus,
    };

    if (newStatus === "completed") {
      updates.completion_time = new Date().toISOString();
      updates.driver_notes = driverNotes || stop.driver_notes;
      
      // Create proof note if provided
      if (proofNote) {
        await createProof.mutateAsync({
          business_id: businessId,
          related_type: "delivery_stop",
          related_id: stop.id,
          proof_type: "note",
          text_note: proofNote,
        });
      }
    }

    await updateStop.mutateAsync(updates);
    setSelectedStop(null);
    setDriverNotes("");
    setProofNote("");
    setAmountCollected("");
  };

  const handleAddStop = async () => {
    if (!deliveryId || !stopForm.location_id) return;
    await createStop.mutateAsync({
      delivery_id: deliveryId,
      location_id: stopForm.location_id,
      stop_type: stopForm.stop_type,
      items_summary: stopForm.items_summary,
      amount_due: stopForm.amount_due ? parseFloat(stopForm.amount_due) : 0,
      stop_order: stops.length + 1,
    });
    setAddStopOpen(false);
    setStopForm({ location_id: "", stop_type: "dropoff", items_summary: "", amount_due: "" });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed": return <XCircle className="h-5 w-5 text-red-500" />;
      case "skipped": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "arrived": return <MapPin className="h-5 w-5 text-blue-500" />;
      case "en_route": return <Truck className="h-5 w-5 text-primary" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const openNavigation = (stop: DeliveryStop) => {
    const location = stop.location;
    if (location?.lat && location?.lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`, "_blank");
    } else if (location?.address_line1) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address_line1 + " " + (location.city || ""))}`, "_blank");
    }
  };

  const callLocation = (stop: DeliveryStop) => {
    if (stop.location?.contact_phone) {
      window.open(`tel:${stop.location.contact_phone}`, "_self");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/delivery/deliveries")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{delivery.delivery_type.replace("_", " ").toUpperCase()}</h1>
            <p className="text-muted-foreground">
              {format(new Date(delivery.scheduled_date), "EEEE, MMMM d")} • {delivery.driver?.full_name || "Unassigned"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {delivery.status === "scheduled" && (
            <Button onClick={handleStartRoute}>
              <Truck className="h-4 w-4 mr-2" />
              Start Route
            </Button>
          )}
          {delivery.status === "in_progress" && remainingStops.length === 0 && (
            <Button onClick={handleCompleteRoute}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete Route
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{stops.length}</p>
              <p className="text-sm text-muted-foreground">Total Stops</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-500">{completedStops.length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-500">{remainingStops.length}</p>
              <p className="text-sm text-muted-foreground">Remaining</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dispatcher Notes */}
      {delivery.dispatcher_notes && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3">
            <p className="text-sm"><strong>Dispatcher Notes:</strong> {delivery.dispatcher_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Add Stop Button */}
      <Dialog open={addStopOpen} onOpenChange={setAddStopOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Stop
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={stopForm.location_id} onValueChange={(v) => setStopForm({ ...stopForm, location_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stop Type</Label>
              <Select value={stopForm.stop_type} onValueChange={(v) => setStopForm({ ...stopForm, stop_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Items Summary</Label>
              <Input 
                value={stopForm.items_summary}
                onChange={(e) => setStopForm({ ...stopForm, items_summary: e.target.value })}
                placeholder="What to deliver/pickup..."
              />
            </div>
            <div className="space-y-2">
              <Label>Amount Due (COD)</Label>
              <Input 
                type="number"
                value={stopForm.amount_due}
                onChange={(e) => setStopForm({ ...stopForm, amount_due: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAddStopOpen(false)}>Cancel</Button>
              <Button onClick={handleAddStop} disabled={!stopForm.location_id || createStop.isPending}>
                Add Stop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stops List */}
      <div className="space-y-3">
        {stops.map((stop, index) => (
          <Card 
            key={stop.id}
            className={`cursor-pointer transition-colors ${stop.status === "completed" ? "bg-green-500/5" : stop.status === "failed" || stop.status === "skipped" ? "bg-muted/50" : "hover:bg-muted/50"}`}
            onClick={() => setSelectedStop(stop)}
          >
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-medium">
                  {index + 1}
                </div>
                {getStatusIcon(stop.status)}
                <div className="flex-1">
                  <p className="font-medium">{stop.location?.name || "Unknown Location"}</p>
                  <p className="text-sm text-muted-foreground">
                    {stop.stop_type} • {stop.location?.address_line1}
                  </p>
                  {stop.items_summary && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Package className="h-3 w-3 inline mr-1" />
                      {stop.items_summary}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant={stop.status === "completed" ? "default" : "outline"}>
                    {stop.status}
                  </Badge>
                  {(stop.amount_due ?? 0) > 0 && (
                    <p className="text-sm font-medium text-green-600 mt-1">
                      <DollarSign className="h-3 w-3 inline" />
                      {stop.amount_due?.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stop Detail Sheet */}
      <Sheet open={!!selectedStop} onOpenChange={(open) => !open && setSelectedStop(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedStop?.location?.name || "Stop Details"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] pr-4">
            {selectedStop && (
              <div className="space-y-6 py-4">
                {/* Location Info */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{selectedStop.location?.address_line1}</p>
                  <p className="text-sm text-muted-foreground">{selectedStop.location?.city}, {selectedStop.location?.state} {selectedStop.location?.zip}</p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openNavigation(selectedStop)}>
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate
                  </Button>
                  {selectedStop.location?.contact_phone && (
                    <Button variant="outline" className="flex-1" onClick={() => callLocation(selectedStop)}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  )}
                </div>

                {/* Amount Due */}
                {(selectedStop.amount_due ?? 0) > 0 && (
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Amount to Collect:</span>
                        <span className="text-xl font-bold text-green-600">
                          ${selectedStop.amount_due?.toFixed(2)}
                        </span>
                      </div>
                      {selectedStop.status !== "completed" && (
                        <div className="mt-2">
                          <Label className="text-xs">Amount Collected</Label>
                          <Input
                            type="number"
                            value={amountCollected}
                            onChange={(e) => setAmountCollected(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Items */}
                {selectedStop.items_summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Items</Label>
                    <p>{selectedStop.items_summary}</p>
                  </div>
                )}

                {/* Driver Notes */}
                {selectedStop.status !== "completed" && selectedStop.status !== "failed" && selectedStop.status !== "skipped" && (
                  <div className="space-y-2">
                    <Label>Driver Notes</Label>
                    <Textarea
                      value={driverNotes}
                      onChange={(e) => setDriverNotes(e.target.value)}
                      placeholder="Add notes about this stop..."
                    />
                  </div>
                )}

                {/* Proof Note */}
                {selectedStop.status !== "completed" && selectedStop.status !== "failed" && selectedStop.status !== "skipped" && (
                  <div className="space-y-2">
                    <Label>Proof Note</Label>
                    <Textarea
                      value={proofNote}
                      onChange={(e) => setProofNote(e.target.value)}
                      placeholder="Describe proof of completion..."
                    />
                  </div>
                )}

                {/* Status Actions */}
                {selectedStop.status !== "completed" && selectedStop.status !== "failed" && selectedStop.status !== "skipped" && (
                  <div className="space-y-2">
                    {selectedStop.status === "pending" && (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => handleStopStatusChange(selectedStop, "en_route")}
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Mark En Route
                      </Button>
                    )}
                    {(selectedStop.status === "pending" || selectedStop.status === "en_route") && (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => handleStopStatusChange(selectedStop, "arrived")}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Mark Arrived
                      </Button>
                    )}
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700" 
                      onClick={() => handleStopStatusChange(selectedStop, "completed")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete Stop
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="destructive"
                        onClick={() => handleStopStatusChange(selectedStop, "failed")}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Failed
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleStopStatusChange(selectedStop, "skipped")}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Skip
                      </Button>
                    </div>
                  </div>
                )}

                {/* Completed Info */}
                {selectedStop.status === "completed" && selectedStop.completion_time && (
                  <div className="text-center text-green-600">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                    <p className="font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedStop.completion_time), "MMM d, h:mm a")}
                    </p>
                  </div>
                )}

                {selectedStop.driver_notes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm">{selectedStop.driver_notes}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
