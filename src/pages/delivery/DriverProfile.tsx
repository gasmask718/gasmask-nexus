import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Edit, Car,
  DollarSign, CheckCircle2, Clock, TrendingUp,
  Route as RouteIcon, MessageCircle, StickyNote, AlertTriangle
} from 'lucide-react';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { ConversationInbox } from '@/components/communication/ConversationInbox';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { ActiveRouteStatus } from '@/components/delivery/ActiveRouteStatus';

const DriverProfile: React.FC = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [showRouteAssign, setShowRouteAssign] = useState(false);

  // Fetch driver details
  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver-crm', driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .maybeSingle();
      if (data) return data;

      // Fallback: driver exists via profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, phone, email, created_at')
        .eq('id', driverId)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          user_id: profile.id,
          business_id: '',
          full_name: profile.name || 'Unknown',
          phone: profile.phone || '',
          email: profile.email || null,
          vehicle_type: null,
          license_number: null,
          home_base: null,
          status: 'active',
          payout_method: null,
          payout_handle: null,
          created_at: profile.created_at,
        };
      }
      return null;
    },
    enabled: !!driverId
  });

  // Fetch routes
  const { data: routes = [] } = useQuery({
    queryKey: ['driver-routes', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes_generated')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverId
  });

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ['driver-payouts', driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_payouts')
        .select('*')
        .eq('worker_id', driverId)
        .eq('worker_type', 'driver')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!driverId
  });

  // Update driver
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('drivers').update(data).eq('id', driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-crm', driverId] });
      toast.success('Driver updated');
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update driver')
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (!driver) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Driver not found</p>
        <Button className="mt-4" onClick={() => navigate('/delivery/drivers')}>Back to Drivers</Button>
      </div>
    );
  }

  const completedRoutes = routes.filter((r: any) => r.status === 'completed').length;
  const totalEarnings = payouts.reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/delivery/drivers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{driver.full_name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                {driver.home_base && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {driver.home_base}
                  </span>
                )}
                <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                  {driver.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit className="h-4 w-4 mr-2" /> Edit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Driver</DialogTitle></DialogHeader>
            <EditDriverForm driver={driver} onSubmit={(data) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Contact & Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <ClickablePhone phone={driver.phone} entityType="other" entityId={driver.id} entityName={driver.full_name} className="font-medium" />
              </div>
            </div>
            {driver.email && (
              <a href={`mailto:${driver.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{driver.email}</p>
                </div>
              </a>
            )}
            {driver.vehicle_type && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Car className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium capitalize">{driver.vehicle_type} {driver.license_number && `• ${driver.license_number}`}</p>
                </div>
              </div>
            )}
            {driver.payout_method && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <DollarSign className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Payout Method</p>
                  <p className="font-medium">{driver.payout_method} {driver.payout_handle && `(${driver.payout_handle})`}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{completedRoutes}</div>
                  <p className="text-sm text-muted-foreground">Routes Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <RouteIcon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{routes.length}</div>
                  <p className="text-sm text-muted-foreground">Total Routes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Routes with Live Status */}
      <ActiveRouteStatus
        workerId={driverId || ''}
        workerName={driver.full_name}
        workerType="driver"
        workerUserId={driver.user_id}
      />

      {/* Tabs */}
      <Tabs defaultValue="routes">
        <TabsList className="flex-wrap">
          <TabsTrigger value="routes"><RouteIcon className="h-4 w-4 mr-2" /> Routes</TabsTrigger>
          <TabsTrigger value="payouts"><DollarSign className="h-4 w-4 mr-2" /> Payouts</TabsTrigger>
          <TabsTrigger value="communication"><MessageCircle className="h-4 w-4 mr-2" /> Communication</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="h-4 w-4 mr-2" /> Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="mt-4">
          {routes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No routes assigned yet</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {routes.map((route: any) => (
                <Card key={route.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RouteIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{route.route_name || `Route ${route.id.slice(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {route.total_stops || 0} stops • {format(new Date(route.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                        {route.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          {payouts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No payouts yet</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout: any) => (
                <Card key={payout.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">${payout.total_to_pay?.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{payout.period_start} to {payout.period_end}</p>
                        </div>
                      </div>
                      <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>{payout.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="communication" className="mt-4">
          <ConversationInbox
            entityType="driver"
            entityId={driverId || ''}
            entityName={driver.full_name}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EntityNotesSection
            entityType="driver"
            entityId={driverId}
            entityName={driver.full_name}
          />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => setShowRouteAssign(true)}
        >
          <RouteIcon className="h-4 w-4 mr-2" /> Assign Route
        </Button>
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => navigate('/delivery/payouts')}
        >
          <DollarSign className="h-4 w-4 mr-2" /> View Payouts
        </Button>
      </div>

      <RouteAssignmentDialog
        open={showRouteAssign}
        onOpenChange={setShowRouteAssign}
        assigneeId={driverId || ''}
        assigneeName={driver.full_name}
        assigneeType="driver"
        assigneeUserId={driver.user_id}
      />
    </div>
  );
};

// Edit Form Component
const EditDriverForm: React.FC<{
  driver: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ driver, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    full_name: driver.full_name || '',
    phone: driver.phone || '',
    email: driver.email || '',
    vehicle_type: driver.vehicle_type || '',
    license_number: driver.license_number || '',
    home_base: driver.home_base || '',
    payout_method: driver.payout_method || '',
    payout_handle: driver.payout_handle || ''
  });

  return (
    <div className="space-y-4 mt-4">
      <div>
        <label className="text-sm font-medium">Full Name</label>
        <Input value={formData.full_name} onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))} />
      </div>
      <div>
        <label className="text-sm font-medium">Phone</label>
        <Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Vehicle Type</label>
          <Input value={formData.vehicle_type} onChange={(e) => setFormData(prev => ({ ...prev, vehicle_type: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm font-medium">License Number</label>
          <Input value={formData.license_number} onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Home Base</label>
        <Input value={formData.home_base} onChange={(e) => setFormData(prev => ({ ...prev, home_base: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Payout Method</label>
          <Input value={formData.payout_method} onChange={(e) => setFormData(prev => ({ ...prev, payout_method: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm font-medium">Payout Handle</label>
          <Input value={formData.payout_handle} onChange={(e) => setFormData(prev => ({ ...prev, payout_handle: e.target.value }))} />
        </div>
      </div>
      <Button className="w-full" onClick={() => onSubmit(formData)} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};

export default DriverProfile;
