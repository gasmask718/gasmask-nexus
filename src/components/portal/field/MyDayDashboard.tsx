import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

interface MyDayDashboardProps {
  portalType: 'driver' | 'biker';
}

interface AssignedStop {
  id: string;
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

export function MyDayDashboard({ portalType }: MyDayDashboardProps) {
  const navigate = useNavigate();
  const { data: profileData } = useCurrentUserProfile();
  const [assignedStops, setAssignedStops] = useState<AssignedStop[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch today's assigned stops (from routes or assignments)
        // For now, we'll fetch recent stores they've visited
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
          .gte('created_at', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentVisits) {
          setAssignedStops(recentVisits.map((v: any) => ({
            id: v.id,
            store_name: v.store_master?.store_name || 'Unknown Store',
            address: v.store_master?.address || '',
            status: v.status || 'pending',
            visit_type: v.visit_type,
          })));
        }

        // Fetch pending change lists
        const { data: changeLists } = await supabase
          .from('change_lists')
          .select(`
            id,
            status,
            created_at,
            store_master:store_id (store_name)
          `)
          .eq('submitted_by', user.id)
          .in('status', ['submitted', 'under_review'])
          .order('created_at', { ascending: false })
          .limit(5);

        if (changeLists) {
          setPendingChanges(changeLists.map((c: any) => ({
            id: c.id,
            store_name: c.store_master?.store_name || 'Unknown Store',
            status: c.status,
            created_at: c.created_at,
          })));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const basePath = portalType === 'driver' ? '/portal/driver' : '/portal/biker';
  const accentClass = portalType === 'driver' ? 'text-hud-cyan' : 'text-hud-green';
  const accentBg = portalType === 'driver' ? 'bg-hud-cyan/10' : 'bg-hud-green/10';

  const completedStops = assignedStops.filter(s => s.status === 'completed').length;
  const pendingStops = assignedStops.filter(s => s.status !== 'completed').length;

  return (
    <div className="space-y-6">
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
            <CardDescription>Assigned Today</CardDescription>
            <CardTitle className="text-3xl">{assignedStops.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Stores to visit</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-600">{completedStops}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Visits done</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Changes</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{pendingChanges.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
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
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/stores`)}
            >
              <Store className={`h-6 w-6 ${accentClass}`} />
              <span>View Stores</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/visit`)}
            >
              <ClipboardCheck className={`h-6 w-6 ${accentClass}`} />
              <span>Start Visit</span>
            </Button>
            
            {portalType === 'driver' && (
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate(`${basePath}/delivery`)}
              >
                <Truck className={`h-6 w-6 ${accentClass}`} />
                <span>Make Delivery</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(`${basePath}/changes`)}
            >
              <FileText className={`h-6 w-6 ${accentClass}`} />
              <span>Change Lists</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Stops */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
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
              <p>No stops assigned for today</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate(`${basePath}/stores`)}
              >
                Browse Stores
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedStops.slice(0, 5).map((stop) => (
                <div 
                  key={stop.id} 
                  className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    stop.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : ''
                  }`}
                  onClick={() => navigate(`${basePath}/visit/${stop.id}`)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    stop.status === 'completed' 
                      ? 'bg-green-500/20 text-green-500' 
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
