import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBusiness } from "@/contexts/BusinessContext";
import { useDeliveries, useStoreChecks, useDrivers, useBikers } from "@/hooks/useDeliveryData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Truck, 
  Bike, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Package,
  DollarSign,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: deliveries = [] } = useDeliveries(businessId, { date: today });
  const { data: storeChecks = [] } = useStoreChecks(businessId, { date: today });
  const { data: drivers = [] } = useDrivers(businessId);
  const { data: bikers = [] } = useBikers(businessId);

  const inProgressDeliveries = deliveries.filter(d => d.status === "in_progress");
  const scheduledDeliveries = deliveries.filter(d => d.status === "scheduled");
  const completedDeliveries = deliveries.filter(d => d.status === "completed");
  
  const pendingChecks = storeChecks.filter(c => c.status === "assigned" || c.status === "in_progress");
  const submittedChecks = storeChecks.filter(c => c.status === "submitted");

  const activeDrivers = drivers.filter(d => d.status === "active");
  const activeBikers = bikers.filter(b => b.status === "active");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery & Logistics</h1>
          <p className="text-muted-foreground">Today: {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/delivery/deliveries")} variant="outline">
            <Package className="h-4 w-4 mr-2" />
            Deliveries Board
          </Button>
          <Button onClick={() => navigate("/delivery/drivers")}>
            <Users className="h-4 w-4 mr-2" />
            Manage Drivers
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Truck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{deliveries.length}</p>
                <p className="text-xs text-muted-foreground">Today's Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inProgressDeliveries.length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedDeliveries.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Bike className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{storeChecks.length}</p>
                <p className="text-xs text-muted-foreground">Store Checks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-500/10 rounded-lg">
                <Users className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDrivers.length}</p>
                <p className="text-xs text-muted-foreground">Active Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Bike className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeBikers.length}</p>
                <p className="text-xs text-muted-foreground">Active Bikers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Deliveries */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Deliveries</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/deliveries")}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {inProgressDeliveries.length === 0 && scheduledDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active deliveries today
              </div>
            ) : (
              <div className="space-y-3">
                {[...inProgressDeliveries, ...scheduledDeliveries].slice(0, 5).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/delivery/route/${delivery.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${delivery.status === 'in_progress' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                        <Truck className={`h-4 w-4 ${delivery.status === 'in_progress' ? 'text-amber-500' : 'text-blue-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{delivery.delivery_type.replace("_", " ").toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {delivery.driver?.full_name || "Unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={delivery.priority === 'urgent' ? 'destructive' : delivery.priority === 'high' ? 'default' : 'secondary'}>
                        {delivery.priority}
                      </Badge>
                      <Badge variant={delivery.status === 'in_progress' ? 'default' : 'outline'}>
                        {delivery.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/deliveries?action=create")}>
              <Package className="h-4 w-4 mr-2" />
              Create Delivery
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/drivers")}>
              <Users className="h-4 w-4 mr-2" />
              Manage Drivers
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/locations")}>
              <MapPin className="h-4 w-4 mr-2" />
              Manage Locations
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/biker-tasks")}>
              <Bike className="h-4 w-4 mr-2" />
              Biker Tasks
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/payouts")}>
              <DollarSign className="h-4 w-4 mr-2" />
              Worker Payouts
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/delivery/debts")}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Debt Collection
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Pending Store Checks */}
      {submittedChecks.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pending Review ({submittedChecks.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/delivery/biker-tasks")}>
              Review All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {submittedChecks.slice(0, 6).map((check) => (
                <div key={check.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>{check.check_type.replace("_", " ")}</Badge>
                    <Badge variant="outline">Submitted</Badge>
                  </div>
                  <p className="font-medium text-sm">{check.location?.name || "Unknown Location"}</p>
                  <p className="text-xs text-muted-foreground">{check.biker?.full_name || "Unknown Biker"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
