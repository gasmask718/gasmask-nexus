import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Camera, Package, MessageSquare, DollarSign, Award, Navigation, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const GPS_INTERVAL_MS = 30_000; // 30 seconds

export default function PortalBiker() {
  const [profile, setProfile] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingActive, setTrackingActive] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const userIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBikerData();
    return () => stopTracking();
  }, []);

  async function fetchBikerData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(profileData);
      setAssignments([]);

      // Auto-link: ensure bikers table has user_id set for this auth user
      await linkBikerRecord(user.id, profileData);

      // Auto-start tracking
      startTracking();
    } catch (error) {
      console.error('Error fetching biker data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load biker data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function linkBikerRecord(authUserId: string, profile: any) {
    try {
      // Check if already linked
      const { data: existing } = await supabase
        .from('bikers')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (existing) return; // Already linked

      // Try to match by email or phone from profile
      const email = profile?.email;
      const phone = profile?.phone;

      let matchQuery = supabase
        .from('bikers')
        .select('id')
        .is('user_id', null);

      if (email) {
        const { data: emailMatch } = await supabase
          .from('bikers')
          .select('id')
          .is('user_id', null)
          .eq('email', email)
          .limit(1)
          .maybeSingle();

        if (emailMatch) {
          await supabase
            .from('bikers')
            .update({ user_id: authUserId })
            .eq('id', emailMatch.id);
          console.log('[BIKER LINK] Linked via email match:', emailMatch.id);
          return;
        }
      }

      if (phone) {
        const { data: phoneMatch } = await supabase
          .from('bikers')
          .select('id')
          .is('user_id', null)
          .eq('phone', phone)
          .limit(1)
          .maybeSingle();

        if (phoneMatch) {
          await supabase
            .from('bikers')
            .update({ user_id: authUserId })
            .eq('id', phoneMatch.id);
          console.log('[BIKER LINK] Linked via phone match:', phoneMatch.id);
          return;
        }
      }

      console.log('[BIKER LINK] No matching biker record found for user:', authUserId);
    } catch (err) {
      console.error('[BIKER LINK] Error linking biker record:', err);
    }
  }

  const sendLocationPing = useCallback(async (lat: number, lng: number) => {
    const userId = userIdRef.current;
    if (!userId) return;

    try {
      const { error } = await supabase.from('location_events').insert({
        user_id: userId,
        event_type: 'gps_ping',
        lat,
        lng,
      });
      if (error) throw error;
      setLastPing(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setLocationError(null);
    } catch (err) {
      console.error('Failed to send location ping:', err);
    }
  }, []);

  function startTracking() {
    if (trackingActive) return;
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported on this device');
      return;
    }

    setTrackingActive(true);
    setLocationError(null);

    // Watch position for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(
          err.code === 1 ? 'Location permission denied. Please enable location access.'
          : err.code === 2 ? 'Location unavailable. Check GPS settings.'
          : 'Location request timed out.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );

    // Send initial ping
    navigator.geolocation.getCurrentPosition(
      (position) => {
        lastCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        sendLocationPing(position.coords.latitude, position.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000 }
    );

    // Send pings every 30s
    intervalRef.current = setInterval(() => {
      if (lastCoordsRef.current) {
        sendLocationPing(lastCoordsRef.current.lat, lastCoordsRef.current.lng);
      }
    }, GPS_INTERVAL_MS);
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTrackingActive(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile?.name || 'Biker Portal'}</h1>
              <p className="text-muted-foreground">GasMask Street Team</p>
            </div>
            <div className="flex items-center gap-2">
              {/* GPS Status Indicator */}
              <Badge 
                variant={trackingActive ? 'default' : 'secondary'}
                className={trackingActive ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {trackingActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white inline-block mr-1.5 animate-pulse" />
                    GPS Active
                  </>
                ) : (
                  'GPS Off'
                )}
              </Badge>
              <Badge variant="default">Active</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Location Status Card */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Navigation className={`h-5 w-5 ${trackingActive ? 'text-green-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-medium">Location Tracking</p>
                {locationError ? (
                  <p className="text-xs text-destructive">{locationError}</p>
                ) : lastPing ? (
                  <p className="text-xs text-muted-foreground">Last ping: {lastPing}</p>
                ) : trackingActive ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Acquiring location...
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not tracking</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={trackingActive ? 'destructive' : 'default'}
              onClick={() => trackingActive ? stopTracking() : startTracking()}
            >
              {trackingActive ? 'Stop' : 'Start'} Tracking
            </Button>
          </div>
        </Card>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <MapPin className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Stops</p>
                    <p className="text-2xl font-bold">{assignments.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <Camera className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Photos Uploaded</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Earnings (Week)</p>
                    <p className="text-2xl font-bold">$0</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Today's Assignments</h3>
              {assignments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No assignments for today</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{assignment.task_type}</p>
                        <p className="text-sm text-muted-foreground">{assignment.description}</p>
                      </div>
                      <Badge>{assignment.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">All Assignments</h3>
              <p className="text-muted-foreground">View your store visit assignments</p>
            </Card>
          </TabsContent>

          <TabsContent value="photos">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Upload Photos</h3>
              <Button>
                <Camera className="mr-2 h-4 w-4" />
                Upload Store Photo
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Messages</h3>
              <p className="text-muted-foreground">Chat with dispatch</p>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Earnings</h3>
              <p className="text-muted-foreground">Track your payouts</p>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performance Score</h3>
              <div className="flex items-center gap-4">
                <Award className="h-12 w-12 text-yellow-500" />
                <div>
                  <p className="text-4xl font-bold">0</p>
                  <p className="text-muted-foreground">Total XP</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
