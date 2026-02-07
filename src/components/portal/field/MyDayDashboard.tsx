import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Store, 
  Truck, 
  ClipboardCheck, 
  AlertTriangle, 
  Phone, 
  FileText, 
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Play,
  Square,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { PagePurpose, CardHelper } from '@/components/portal/guidance';
import { usePrimaryResponsiveContactBatch } from '@/hooks/usePrimaryResponsiveContact';
import { StoreContactIntelBadge } from '@/components/contact/StoreContactIntelBadge';

interface MyDayDashboardProps {
  portalType: 'driver' | 'biker';
}

interface AssignedStop {
  id: string;
  store_id: string;
  store_name: string;
  address: string;
  status: 'pending' | 'in_progress' | 'completed';
  visit_type: string;
}

interface PendingChange {
  id: string;
  store_name: string;
  status: string;
  created_at: string;
}

type ShiftStatus = 'not_started' | 'active' | 'ended';

export function MyDayDashboard({ portalType }: MyDayDashboardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: profileData } = useCurrentUserProfile();
  const { t, isRTL } = useTranslation();
  const [assignedStops, setAssignedStops] = useState<AssignedStop[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('not_started');
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = new Date().toISOString().split('T')[0];

        // Check if shift is active today using driver_sessions
        const { data: sessionData } = await supabase
          .from('driver_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', today)
          .order('started_at', { ascending: false })
          .limit(1);

        if (sessionData && sessionData.length > 0) {
          const session = sessionData[0];
          if (session.ended_at) {
            setShiftStatus('ended');
          } else if (session.is_active) {
            setShiftStatus('active');
            setShiftStartTime(session.started_at ? new Date(session.started_at) : null);
          }
        }

        // Fetch today's assigned stops (from routes or assignments)
        const { data: recentVisits } = await supabase
          .from('store_visits')
          .select(`
            id,
            store_id,
            status,
            visit_type,
            store_master:store_id (store_name, address)
          `)
          .eq('visited_by', user.id)
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentVisits) {
          setAssignedStops(recentVisits.map((v: any) => ({
            id: v.id,
            store_id: v.store_id,
            store_name: v.store_master?.store_name || 'Unknown Store',
            address: v.store_master?.address || '',
            status: v.status || 'pending',
            visit_type: v.visit_type,
          })));
        }

        // Fetch pending field submissions (governance pipeline)
        const { data: fieldSubmissions } = await supabase
          .from('field_submissions')
          .select(`
            id,
            submission_status,
            created_at,
            entity_type,
            store:store_master(store_name)
          `)
          .eq('submitted_by_user_id', user.id)
          .eq('submission_status', 'pending_review')
          .order('created_at', { ascending: false })
          .limit(5);

        if (fieldSubmissions) {
          setPendingChanges(fieldSubmissions.map((c: any) => ({
            id: c.id,
            store_name: c.store?.store_name || 'Unknown Store',
            status: c.submission_status === 'pending_review' ? 'Pending Review' : c.submission_status,
            created_at: c.created_at,
          })));
        }

        // Count unread messages (mock for now)
        setUnreadMessages(Math.floor(Math.random() * 3));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleStartShift = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('driver_sessions')
        .insert({
          user_id: user.id,
          started_at: new Date().toISOString(),
          is_active: true,
        });

      if (error) throw error;

      setShiftStatus('active');
      setShiftStartTime(new Date());
      toast({
        title: 'Shift Started',
        description: 'Your shift has begun. Drive safely!',
      });
    } catch (error) {
      console.error('Error starting shift:', error);
      toast({
        title: 'Error',
        description: 'Could not start shift. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEndShift = async () => {
    // Check if there are active deliveries
    const activeStops = assignedStops.filter(s => s.status === 'in_progress');
    if (activeStops.length > 0) {
      toast({
        title: 'Cannot End Shift',
        description: `You have ${activeStops.length} active delivery/visit(s). Complete them first.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('driver_sessions')
        .update({
          ended_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('user_id', user.id)
        .gte('started_at', today)
        .is('ended_at', null);

      if (error) throw error;

      setShiftStatus('ended');
      toast({
        title: 'Shift Ended',
        description: 'Your shift has been completed. Great work today!',
      });
    } catch (error) {
      console.error('Error ending shift:', error);
      toast({
        title: 'Error',
        description: 'Could not end shift. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const basePath = portalType === 'driver' ? '/portal/driver' : '/portal/biker';
  const accentClass = portalType === 'driver' ? 'text-hud-cyan' : 'text-hud-green';
  const accentBg = portalType === 'driver' ? 'bg-hud-cyan/10' : 'bg-hud-green/10';

  // Batch-load contact intelligence for today's stops
  const stopStoreIds = useMemo(() => assignedStops.map(s => s.store_id).filter(Boolean), [assignedStops]);
  const { contactsByStore } = usePrimaryResponsiveContactBatch(stopStoreIds);

  const completedStops = assignedStops.filter(s => s.status === 'completed').length;
  const pendingStops = assignedStops.filter(s => s.status !== 'completed').length;

  // Page purpose configuration by role
  const dashboardPurpose = {
    driver: {
      title: t('page.dashboard.purpose'),
      description: t('page.dashboard.purpose'),
      actions: [
        t('page.dashboard.action.view_stores'),
        t('page.dashboard.action.start_visit'),
        t('page.dashboard.action.check_changes'),
      ],
      warnings: [],
    },
    biker: {
      title: t('page.dashboard.purpose'),
      description: t('page.dashboard.purpose'),
      actions: [
        t('page.dashboard.action.view_stores'),
        t('page.dashboard.action.start_visit'),
        t('page.dashboard.action.check_changes'),
      ],
      warnings: [],
    },
    default: {
      title: t('page.dashboard.purpose'),
      description: t('page.dashboard.purpose'),
      actions: [
        t('page.dashboard.action.view_stores'),
        t('page.dashboard.action.start_visit'),
      ],
      warnings: [],
    },
  };

  return (
    <div className={cn('space-y-6', isRTL && 'text-right')}>
      {/* Page Purpose - Role-aware guidance */}
      <PagePurpose 
        pageKey="dashboard" 
        config={dashboardPurpose}
        variant="default"
      />
      {/* Shift Control Card */}
      <Card className={shiftStatus === 'active' ? 'border-success/50 bg-success/5' : shiftStatus === 'ended' ? 'border-muted' : 'border-warning/50 bg-warning/5'}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                shiftStatus === 'active' ? 'bg-success/20 text-success' : 
                shiftStatus === 'ended' ? 'bg-muted text-muted-foreground' : 'bg-warning/20 text-warning'
              }`}>
                {shiftStatus === 'active' ? <Play className="h-6 w-6" /> : 
                 shiftStatus === 'ended' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-semibold">
                   {shiftStatus === 'active' ? t('page.dashboard.shift_active') : 
                    shiftStatus === 'ended' ? t('page.dashboard.shift_completed') : t('page.dashboard.shift_not_started')}
                </p>
                <p className="text-sm text-muted-foreground">
                   {shiftStatus === 'active' && shiftStartTime 
                     ? `${t('page.dashboard.started_at')} ${shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                     : shiftStatus === 'ended' ? t('page.dashboard.great_work') : t('page.dashboard.start_shift_prompt')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {shiftStatus === 'not_started' && (
                <Button onClick={handleStartShift} className="gap-2">
                  <Play className="h-4 w-4" /> {t('action.start_shift')}
                </Button>
              )}
              {shiftStatus === 'active' && (
                <Button variant="destructive" onClick={handleEndShift} className="gap-2">
                  <Square className="h-4 w-4" /> {t('action.end_shift')}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`${basePath}/messages`)} className="gap-2 relative">
                <MessageSquare className="h-4 w-4" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Good {getTimeOfDay()}, {profileData?.profile?.full_name?.split(' ')[0] || 'Team Member'}
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Badge variant="outline" className="uppercase">
          {portalType}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={accentBg}>
          <CardHeader className="pb-2">
            <CardDescription>{t('page.dashboard.assigned_today')}</CardDescription>
            <CardTitle className="text-3xl">{assignedStops.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('page.dashboard.stores_to_visit')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('page.dashboard.completed')}</CardDescription>
            <CardTitle className="text-3xl text-success">{completedStops}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('page.dashboard.visits_done')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('page.dashboard.pending_changes')}</CardDescription>
            <CardTitle className="text-3xl text-warning">{pendingChanges.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('page.dashboard.awaiting_review')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Non-Responsive</CardDescription>
            <CardTitle className="text-3xl text-destructive">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Stores flagged</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('page.dashboard.quick_actions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/stores`)}
            >
              <Store className={`h-6 w-6 ${accentClass}`} />
              <span>{t('action.view_stores')}</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/visit`)}
            >
              <ClipboardCheck className={`h-6 w-6 ${accentClass}`} />
              <span>{t('action.start_visit')}</span>
            </Button>
            
            {portalType === 'driver' && (
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate(`${basePath}/delivery`)}
              >
                <Truck className={`h-6 w-6 ${accentClass}`} />
                <span>{t('action.make_delivery')}</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/changes`)}
            >
              <FileText className={`h-6 w-6 ${accentClass}`} />
              <span>{t('portal.nav.changes')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Stops */}
      <Card className="overflow-hidden">
        <CardHelper 
          summary={t('card.stops')}
          variant="expandable"
          details={portalType === 'driver' 
            ? "Complete visits to record inventory and delivery information."
            : "Visit stores to verify inventory and sticker status."
          }
          dataSource="Assigned routes & schedules"
        />
        <CardHeader>
          <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
            <div>
              <CardTitle className={cn('text-lg flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <Calendar className="h-5 w-5" />
                Today's Stops
              </CardTitle>
              <CardDescription>Your assigned store visits for today</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/stores`)}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : assignedStops.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('page.dashboard.no_stops')}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate(`${basePath}/stores`)}
              >
                {t('action.browse_stores')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedStops.slice(0, 5).map((stop) => (
                <div 
                  key={stop.id} 
                   className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                     stop.status === 'completed' ? 'border-success/30 bg-success/5' : ''
                   }`}
                  onClick={() => navigate(`${basePath}/visit/${stop.id}`)}
                >
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                     stop.status === 'completed' 
                       ? 'bg-success/20 text-success' 
                       : accentBg + ' ' + accentClass
                   }`}>
                    {stop.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Store className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{stop.store_name}</p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {stop.address || 'No address'}
                    </p>
                    <StoreContactIntelBadge 
                      contact={contactsByStore[stop.store_id]} 
                      compact 
                      className="mt-0.5" 
                    />
                  </div>
                  <Badge variant={stop.status === 'completed' ? 'default' : 'secondary'}>
                    {stop.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Changes */}
      {pendingChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Submissions
            </CardTitle>
            <CardDescription>Your changes awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingChanges.map((change) => (
                <div 
                  key={change.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{change.store_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(change.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{change.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}
