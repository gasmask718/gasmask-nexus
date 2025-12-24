import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  Camera, 
  DollarSign,
  Phone,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useGeofencing } from "@/hooks/useGeofencing";

interface RouteStop {
  id: string;
  planned_order: number;
  status: string;
  store_id: string;
  stores: {
    id: string;
    name: string;
    address_street: string;
    address_city: string;
    lat: number;
    lng: number;
    phone: string;
  };
}

interface TodayRoute {
  id: string;
  date: string;
  territory: string;
  status: string;
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  route_stops: RouteStop[];
}

export default function Driver() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [todayRoute, setTodayRoute] = useState<TodayRoute | null>(null);
  const [currentStop, setCurrentStop] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndRoute();
  }, []);

  const loadUserAndRoute = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate('/auth');
      return;
    }

    // Just load the profile for display purposes - access is controlled by RequireRole
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profile) {
      setUser(profile);
    }
    
    loadTodayRoute();
  };

  const loadTodayRoute = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: routes, error } = await supabase
        .from('routes')
        .select(`
          *,
          route_stops(
            *,
            stores(*)
          )
        `)
        .eq('date', today)
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (routes && routes.length > 0) {
        const route = routes[0] as any;
        route.route_stops.sort((a: RouteStop, b: RouteStop) => 
          a.planned_order - b.planned_order
        );
        setTodayRoute(route);
      }
    } catch (error) {
      console.error('Error loading route:', error);
      toast.error('Failed to load today\'s route');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (stop: RouteStop) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${stop.stores.lat},${stop.stores.lng}`;
    window.open(url, '_blank');
  };

  const handleCheckIn = async (stop: RouteStop) => {
    try {
      // Get current position
      if (!navigator.geolocation) {
        toast.error('Geolocation not supported');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // Calculate distance to store
          const distance = calculateDistance(
            latitude,
            longitude,
            stop.stores.lat,
            stop.stores.lng
          );

          // Update route stop status
          const { error: stopError } = await supabase
            .from('route_stops')
            .update({ status: 'in_progress' })
            .eq('id', stop.id);

          if (stopError) throw stopError;

          // Log location event
          const { error: eventError } = await supabase
            .from('location_events')
            .insert({
              user_id: user.id,
              store_id: stop.store_id,
              event_type: 'check_in',
              lat: latitude,
              lng: longitude,
              distance_from_store_meters: distance,
            });

          if (eventError) throw eventError;

          toast.success(`Checked in at ${stop.stores.name}`);
          loadTodayRoute();
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Failed to get location');
        }
      );
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('Failed to check in');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleComplete = async (stop: RouteStop) => {
    navigate(`/stores/${stop.store_id}?visit=true`);
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading route...</p>
        </div>
      </div>
    );
  }

  if (!todayRoute) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Route Assigned</h2>
          <p className="text-muted-foreground mb-6">
            You don't have a route assigned for today. Contact dispatch.
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const completedStops = todayRoute.route_stops.filter(s => s.status === 'completed').length;
  const totalStops = todayRoute.route_stops.length;
  const nextStop = todayRoute.route_stops.find(s => s.status === 'pending');

  // Enable geofencing for auto check-in
  const storesForGeofencing = todayRoute.route_stops
    .filter(s => s.status === 'pending')
    .map(s => ({
      id: s.store_id,
      name: s.stores.name,
      lat: s.stores.lat,
      lng: s.stores.lng,
    }));

  useGeofencing({
    stores: storesForGeofencing,
    userId: user?.id || '',
    onCheckIn: (storeId, storeName) => {
      loadTodayRoute(); // Refresh route after auto check-in
    },
    radius: 50, // 50 meter radius
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">Today's Route</h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <Badge variant={todayRoute.status === 'completed' ? 'default' : 'secondary'}>
            {todayRoute.status}
          </Badge>
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{completedStops}/{totalStops} stops</span>
          </div>
          <div className="flex items-center gap-1">
            <Navigation className="h-4 w-4 text-primary" />
            <span>{todayRoute.estimated_distance_km}km</span>
          </div>
          <div className="flex items-center gap-1">
            <span>~{todayRoute.estimated_duration_minutes}min</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedStops / totalStops) * 100}%` }}
          />
        </div>
      </div>

      {/* Next Stop Card */}
      {nextStop && (
        <div className="p-4">
          <Card className="p-4 border-primary bg-primary/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">NEXT STOP</p>
                <h2 className="text-lg font-bold">{nextStop.stores.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {nextStop.stores.address_street}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                Stop {nextStop.planned_order}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => handleNavigate(nextStop)}
                className="w-full"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleCheckIn(nextStop)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Check In
              </Button>
              {nextStop.stores.phone && (
                <Button 
                  variant="outline"
                  onClick={() => handleCall(nextStop.stores.phone)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
              <Button 
                onClick={() => handleComplete(nextStop)}
                variant="default"
              >
                <Camera className="h-4 w-4 mr-2" />
                Complete Visit
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* All Stops List */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">ALL STOPS</h3>
        
        {todayRoute.route_stops.map((stop, idx) => (
          <Card 
            key={stop.id} 
            className={`p-4 ${
              stop.status === 'completed' ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                ${stop.status === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}
              `}>
                {stop.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  stop.planned_order
                )}
              </div>

              <div className="flex-1">
                <h4 className="font-semibold">{stop.stores.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {stop.stores.address_street}, {stop.stores.address_city}
                </p>
                
                {stop.status !== 'completed' && (
                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleNavigate(stop)}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Navigate
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleComplete(stop)}
                    >
                      Visit
                    </Button>
                  </div>
                )}
              </div>

              <Badge variant={
                stop.status === 'completed' ? 'default' :
                stop.status === 'in_progress' ? 'secondary' : 'outline'
              }>
                {stop.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}