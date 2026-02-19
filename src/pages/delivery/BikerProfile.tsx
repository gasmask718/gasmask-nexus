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
import { format } from 'date-fns';
import { 
  Bike, Phone, Mail, MapPin, Edit,
  DollarSign, CheckCircle2, Clock, TrendingUp, Shield,
  ClipboardCheck, AlertCircle, AlertTriangle, Calendar,
  MessageCircle, StickyNote, Route as RouteIcon,
  Gauge, Target, Activity
} from 'lucide-react';
import { useBikerIssues } from '@/hooks/useBikerIssues';
import BikerPerformanceTab from '@/components/biker/BikerPerformanceTab';
import BikerIssuesTab from '@/components/biker/BikerIssuesTab';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { BikerLocationPreview } from '@/components/map/BikerLocationPreview';
import { ConversationInbox } from '@/components/communication/ConversationInbox';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { ActiveRouteStatus } from '@/components/delivery/ActiveRouteStatus';
import { CurrentTaskCard } from '@/components/delivery/CurrentTaskCard';
import { ProfileLayout, ProfileTab } from '@/components/profile/ProfileLayout';
import { ProfileActivityPanel } from '@/components/profile';

const BikerProfile: React.FC = () => {
  const { bikerId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [showRouteAssign, setShowRouteAssign] = useState(false);

  // Fetch biker details
  const { data: biker, isLoading } = useQuery({
    queryKey: ['biker', bikerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bikers')
        .select('*')
        .eq('id', bikerId)
        .maybeSingle();
      if (data) return data;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, phone, email, created_at')
        .eq('id', bikerId)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          user_id: profile.id,
          business_id: '',
          full_name: profile.name || 'Unknown',
          phone: profile.phone || '',
          email: profile.email || null,
          territory: null,
          status: 'active',
          payout_method: null,
          payout_handle: null,
          created_at: profile.created_at,
        };
      }
      return null;
    },
    enabled: !!bikerId
  });

  // Fetch canonical routes (portal parity)
  const { data: canonicalRoutes = [] } = useQuery({
    queryKey: ['biker-canonical-routes', bikerId],
    queryFn: async () => {
      const userId = biker?.user_id || bikerId;
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('assigned_to', userId)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!biker
  });

  // Fetch route stops for analytics
  const { data: routeStops = [] } = useQuery({
    queryKey: ['biker-route-stops', bikerId],
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

  // Fetch store checks (legacy tasks)
  const { data: tasks = [] } = useQuery({
    queryKey: ['biker-tasks', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_checks')
        .select(`*, location:locations(*)`)
        .eq('assigned_biker_id', bikerId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bikerId
  });

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ['biker-payouts', bikerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_payouts')
        .select('*')
        .eq('worker_id', bikerId)
        .eq('worker_type', 'biker')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bikerId
  });

  // Update biker
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('bikers').update(data).eq('id', bikerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biker', bikerId] });
      toast.success('Biker updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update biker')
  });

  if (isLoading || !biker) {
    return (
      <ProfileLayout
        isLoading={true}
        header={{ icon: <Bike />, title: '' }}
        tabs={[]}
        backPath="/delivery/bikers"
      />
    );
  }

  // ─── Performance Metrics ───
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const pendingTasks = tasks.filter((t: any) => t.status === 'pending' || t.status === 'assigned').length;
  const totalEarnings = payouts.reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);
  const paidOut = payouts.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.total_to_pay || 0), 0);
  const pendingPay = totalEarnings - paidOut;

  const completedRoutes = canonicalRoutes.filter(r => r.status === 'completed').length;
  const totalRoutes = canonicalRoutes.length;
  const completedStops = routeStops.filter((s: any) => s.status === 'completed').length;
  const totalStops = routeStops.length;
  const completionRate = totalRoutes > 0 ? Math.round((completedRoutes / totalRoutes) * 100) : (tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0);

  // ─── Tabs ───
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

          {/* Current Delivery Task */}
          <CurrentTaskCard workerId={bikerId!} workerType="biker" />

          {/* Active Routes */}
          <ActiveRouteStatus
            workerId={bikerId || ''}
            workerName={biker.full_name}
            workerType="biker"
            workerUserId={biker.user_id}
          />

          {/* Contact Card */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <ClickablePhone phone={biker.phone} entityType="other" entityId={biker.id} entityName={biker.full_name} className="font-medium" />
                </div>
              </div>
              {biker.email && (
                <a href={`mailto:${biker.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{biker.email}</p>
                  </div>
                </a>
              )}
              {biker.territory && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Territory</p>
                    <p className="font-medium">{biker.territory}</p>
                  </div>
                </div>
              )}
              {biker.payout_method && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payout Method</p>
                    <p className="font-medium">{biker.payout_method} {biker.payout_handle && `(${biker.payout_handle})`}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Map */}
          <BikerLocationPreview 
            bikerId={bikerId || ''} 
            bikerName={biker.full_name} 
            height="300px"
          />
        </div>
      ),
    },
    {
      id: 'performance',
      label: 'Performance',
      content: (
        <div className="space-y-6">
          {/* Performance Summary */}
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
                <CheckCircle2 className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completedTasks}</div>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Activity className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completedStops}</div>
                <p className="text-xs text-muted-foreground">Route Stops</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{completedRoutes}</div>
                <p className="text-xs text-muted-foreground">Routes Done</p>
              </CardContent>
            </Card>
          </div>

          {/* Biker Performance Tab (existing component) */}
          <BikerPerformanceTab bikerId={bikerId || ''} />
        </div>
      ),
    },
    {
      id: 'tasks',
      label: 'Tasks',
      count: tasks.length,
      content: (
        <Card>
          <CardHeader><CardTitle className="text-lg">Store Checks & Tasks</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No tasks assigned yet</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{task.location?.name || 'Unknown Location'}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.task_type} • {format(new Date(task.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'issues',
      label: 'Issues',
      content: <BikerIssuesTab bikerId={bikerId || ''} />,
    },
    {
      id: 'payouts',
      label: 'Payouts',
      count: payouts.length,
      content: (
        <div className="space-y-6">
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
      id: 'activity',
      label: 'Activity',
      content: (
        <ProfileActivityPanel
          userId={biker?.user_id || bikerId || null}
          entityName={biker.full_name}
        />
      ),
    },
    {
      id: 'communication',
      label: 'Comms',
      content: (
        <ConversationInbox
          entityType="biker"
          entityId={bikerId || ''}
          entityName={biker.full_name}
        />
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      content: (
        <EntityNotesSection
          entityType="biker"
          entityId={bikerId}
          entityName={biker.full_name}
        />
      ),
    },
  ];

  const statsRow = (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">{completedTasks}</div>
          <p className="text-xs text-muted-foreground">Tasks Done</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <div className="text-xl font-bold">{pendingTasks}</div>
          <p className="text-xs text-muted-foreground">Pending</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <RouteIcon className="h-5 w-5 mx-auto text-primary mb-1" />
          <div className="text-xl font-bold">{completedRoutes}</div>
          <p className="text-xs text-muted-foreground">Routes Done</p>
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
          icon: <Bike className="h-6 w-6" />,
          title: biker.full_name,
          subtitle: biker.territory ? `Territory: ${biker.territory}` : 'Biker',
          status: {
            label: biker.status || 'active',
            variant: biker.status === 'active' ? 'default' : 'secondary',
          },
          metadata: [
            ...(biker.phone ? [{ icon: <Phone className="h-3.5 w-3.5" />, label: biker.phone }] : []),
            ...(biker.created_at ? [{ icon: <Calendar className="h-3.5 w-3.5" />, label: `Since ${format(new Date(biker.created_at), 'MMM yyyy')}` }] : []),
          ],
        }}
        stats={statsRow}
        tabs={tabs}
        defaultTab="overview"
        backPath="/delivery/bikers"
        backLabel="Back to Bikers"
        onCall={() => navigate('/communications-center', { state: { activeModule: 'va-call', contactPhone: biker.phone, contactName: biker.full_name } })}
        onMessage={() => navigate('/communications-center', { state: { activeModule: 'text', contactPhone: biker.phone } })}
        actions={
          <>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Edit className="mr-1 h-4 w-4" /> Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Biker</DialogTitle></DialogHeader>
                <EditBikerForm biker={biker} onSubmit={(data) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />
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
        assigneeId={bikerId || ''}
        assigneeName={biker.full_name}
        assigneeType="biker"
        assigneeUserId={biker.user_id}
      />
    </>
  );
};

// Edit Form Component
const EditBikerForm: React.FC<{
  biker: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ biker, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    full_name: biker.full_name || '',
    phone: biker.phone || '',
    email: biker.email || '',
    territory: biker.territory || '',
    payout_method: biker.payout_method || '',
    payout_handle: biker.payout_handle || ''
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
      <div>
        <label className="text-sm font-medium">Territory</label>
        <Input value={formData.territory} onChange={(e) => setFormData(prev => ({ ...prev, territory: e.target.value }))} />
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

export default BikerProfile;
