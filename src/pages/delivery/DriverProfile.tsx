/**
 * @deprecated routes_generated is legacy as of 2026-05-09.
 * Use the canonical `routes` table instead.
 * This consumer is preserved for historical data access only.
 * Do not write new logic against routes_generated.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Edit, Car,
  DollarSign, CheckCircle2, Clock, TrendingUp, Shield,
  Route as RouteIcon, MessageCircle, StickyNote, AlertTriangle,
  Calendar, Gauge, Target, Activity
} from 'lucide-react';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { ConversationInbox } from '@/components/communication/ConversationInbox';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { ActiveRouteStatus } from '@/components/delivery/ActiveRouteStatus';
import { ProfileLayout, ProfileTab } from '@/components/profile/ProfileLayout';
import { ProfileActivityPanel } from '@/components/profile';
import { useUnifiedProfileView } from '@/hooks/useUnifiedProfileView';
import { OpsParticipationSummary } from '@/components/profile/OpsParticipationSummary';

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

  // Fetch canonical routes (portal parity)
  const { data: canonicalRoutes = [] } = useQuery({
    queryKey: ['driver-canonical-routes', driverId],
    queryFn: async () => {
      const userId = driver?.user_id || driverId;
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('assigned_to', userId)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!driver
  });

  // Fetch legacy routes
  const { data: legacyRoutes = [] } = useQuery({
    queryKey: ['driver-legacy-routes', driverId],
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

  // Fetch route stops for performance analytics
  const { data: routeStops = [] } = useQuery({
    queryKey: ['driver-route-stops', driverId],
    queryFn: async () => {
      const routeIds = canonicalRoutes.map(r => r.id);
      if (routeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('route_stops')
        .select('*')
        .in('route_id', routeIds);
      if (error) throw error;
      return data || [];
    },
    enabled: canonicalRoutes.length > 0
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
        .limit(20);
      if (error) throw error;
      return data || [];
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

  const unifiedProfile = useUnifiedProfileView({
    userId: driver?.user_id || driverId || null,
    role: 'driver',
    displayName: driver?.full_name || '',
    status: driver?.status || 'active',
    joinedAt: driver?.created_at || null,
    phone: driver?.phone,
    email: driver?.email,
    territory: driver?.home_base,
  });

  if (isLoading || !driver) {
    return (
      <ProfileLayout
        isLoading={true}
        header={{ icon: <User />, title: '' }}
        tabs={[]}
        backPath="/delivery/drivers"
      />
    );
  }

  // ─── Compute Performance Metrics ───
  const allRoutes = canonicalRoutes.length > 0 ? canonicalRoutes : legacyRoutes;
  const completedRoutes = canonicalRoutes.filter(r => r.status === 'completed').length + legacyRoutes.filter((r: any) => r.status === 'completed').length;
  const totalRoutes = canonicalRoutes.length + legacyRoutes.length;
  const totalEarnings = payouts.reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);
  const paidOut = payouts.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);
  const pendingPay = totalEarnings - paidOut;

  const completedStops = routeStops.filter((s: any) => s.status === 'completed').length;
  const totalStops = routeStops.length;
  const onTimeRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
  const completionRate = totalRoutes > 0 ? Math.round((completedRoutes / totalRoutes) * 100) : 0;

  // ─── ProfileLayout Config ───
  const tabs: ProfileTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Governance Banner */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-3 px-4">
              <p className="text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline mr-1 text-amber-500" />
                This profile is an operational mirror of portal activity. Metrics are observational and do not trigger discipline, automation, or ranking. All dispatch and payout logic remains unchanged.
              </p>
            </CardContent>
          </Card>

          {/* Active Routes */}
          <ActiveRouteStatus
            workerId={driverId || ''}
            workerName={driver.full_name}
            workerType="driver"
            workerUserId={driver.user_id}
          />

          {/* Contact Card */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Contact & Vehicle</CardTitle></CardHeader>
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
              {driver.home_base && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Home Base</p>
                    <p className="font-medium">{driver.home_base}</p>
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
        </div>
      ),
    },
    {
      id: 'performance',
      label: 'Performance',
      content: (
        <div className="space-y-6">
          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Gauge className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completionRate}%</div>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{onTimeRate}%</div>
                <p className="text-xs text-muted-foreground">Stop Completion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completedStops}</div>
                <p className="text-xs text-muted-foreground">Stops Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completedRoutes}</div>
                <p className="text-xs text-muted-foreground">Routes Completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Route History with Details */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Route History</CardTitle></CardHeader>
            <CardContent>
              {allRoutes.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No routes assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {allRoutes.slice(0, 15).map((route: any) => {
                    const stops = routeStops.filter((s: any) => s.route_id === route.id);
                    const done = stops.filter((s: any) => s.status === 'completed').length;
                    return (
                      <div key={route.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <RouteIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{route.territory || route.route_name || `Route ${route.id.slice(0, 8)}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(route.date || route.created_at), 'MMM d, yyyy')}
                              {stops.length > 0 && ` • ${done}/${stops.length} stops`}
                            </p>
                          </div>
                        </div>
                        <Badge variant={route.status === 'completed' ? 'default' : 'secondary'}>
                          {route.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'payouts',
      label: 'Payouts',
      count: payouts.length,
      content: (
        <div className="space-y-6">
          {/* Payout Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">${totalEarnings.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">${paidOut.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Paid Out</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">${pendingPay.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
          </div>

          {/* Payout Ledger */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Payout Ledger</CardTitle></CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No payouts yet</p>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout: any) => (
                    <div key={payout.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">${payout.total_to_pay?.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{payout.period_start} to {payout.period_end}</p>
                        </div>
                      </div>
                      <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'}>{payout.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'communication',
      label: 'Comms',
      content: (
        <ConversationInbox
          entityType="driver"
          entityId={driverId || ''}
          entityName={driver.full_name}
        />
      ),
    },
    {
      id: 'ops',
      label: 'Ops',
      content: (
        <div className="space-y-6">
          <OpsParticipationSummary
            data={unifiedProfile.opsParticipation}
            isLoading={unifiedProfile.isLoading}
            entityName={driver.full_name}
          />
          <ProfileActivityPanel
            userId={driver?.user_id || driverId || null}
            entityName={driver.full_name}
          />
        </div>
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      content: (
        <EntityNotesSection
          entityType="driver"
          entityId={driverId}
          entityName={driver.full_name}
        />
      ),
    },
  ];

  const statsRow = (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">{completedRoutes}</div>
          <p className="text-xs text-muted-foreground">Routes Done</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <RouteIcon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <div className="text-xl font-bold">{totalRoutes}</div>
          <p className="text-xs text-muted-foreground">Total Routes</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <Target className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">{completedStops}</div>
          <p className="text-xs text-muted-foreground">Stops Done</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">${totalEarnings.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Earnings</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <Gauge className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">{completionRate}%</div>
          <p className="text-xs text-muted-foreground">Completion</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <ProfileLayout
        header={{
          icon: <Car className="h-6 w-6" />,
          title: driver.full_name,
          subtitle: driver.home_base ? `Based in ${driver.home_base}` : 'Driver',
          status: {
            label: driver.status || 'active',
            variant: driver.status === 'active' ? 'default' : 'secondary',
          },
          badges: [
            ...(driver.vehicle_type ? [{ label: driver.vehicle_type, variant: 'outline' as const }] : []),
          ],
          metadata: [
            ...(driver.phone ? [{ icon: <Phone className="h-3.5 w-3.5" />, label: driver.phone }] : []),
            ...(driver.created_at ? [{ icon: <Calendar className="h-3.5 w-3.5" />, label: `Since ${format(new Date(driver.created_at), 'MMM yyyy')}` }] : []),
          ],
        }}
        stats={statsRow}
        tabs={tabs}
        defaultTab="overview"
        backPath="/delivery/drivers"
        backLabel="Back to Drivers"
        onCall={() => navigate('/communications-center', { state: { activeModule: 'va-call', contactPhone: driver.phone, contactName: driver.full_name } })}
        onMessage={() => navigate('/communications-center', { state: { activeModule: 'text', contactPhone: driver.phone } })}
        actions={
          <>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Edit className="mr-1 h-4 w-4" /> Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Driver</DialogTitle></DialogHeader>
                <EditDriverForm driver={driver} onSubmit={(data) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={() => setShowRouteAssign(true)}>
              <RouteIcon className="mr-1 h-4 w-4" /> Assign Route
            </Button>
          </>
        }
      />

      <RouteAssignmentDialog
        open={showRouteAssign}
        onOpenChange={setShowRouteAssign}
        assigneeId={driverId || ''}
        assigneeName={driver.full_name}
        assigneeType="driver"
        assigneeUserId={driver.user_id}
      />
    </>
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
