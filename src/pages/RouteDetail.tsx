import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  User, 
  Truck,
  Bike,
  Clock,
  CheckCircle2,
  Circle,
  Navigation,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface Route {
  id: string;
  date: string;
  type: string;
  territory: string;
  status: string;
  assigned_to: string | null;
  assigned_user?: {
    name: string;
    phone: string;
  };
}

interface RouteStop {
  id: string;
  planned_order: number;
  status: string;
  notes_to_worker: string;
  store: {
    id: string;
    name: string;
    address_street: string;
    address_city: string;
    address_state: string;
    phone: string;
    status: string;
  };
}

const RouteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRouteData = async () => {
      if (!id) return;

      try {
        // Fetch route details
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select(`
            *,
            assigned_user:profiles(name, phone)
          `)
          .eq('id', id)
          .single();

        if (routeError) throw routeError;
        setRoute(routeData as any);

        // Fetch route stops
        const { data: stopsData, error: stopsError } = await supabase
          .from('route_stops')
          .select(`
            id,
            planned_order,
            status,
            notes_to_worker,
            store:stores(
              id,
              name,
              address_street,
              address_city,
              address_state,
              phone,
              status
            )
          `)
          .eq('route_id', id)
          .order('planned_order');

        if (stopsError) throw stopsError;
        setStops(stopsData as any || []);
      } catch (error) {
        console.error('Error fetching route data:', error);
        toast.error('Failed to load route details');
      } finally {
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const completedStops = stops.filter(s => s.status === 'completed').length;
  const progress = stops.length > 0 ? (completedStops / stops.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Route not found</p>
          <Button onClick={() => navigate('/routes')}>Back to Routes</Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/routes')}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  route.type === 'driver' ? 'bg-green-500/10' : 'bg-blue-500/10'
                }`}>
                  {route.type === 'driver' ? (
                    <Truck className="h-5 w-5 text-green-500" />
                  ) : (
                    <Bike className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight capitalize">
                    {route.type} Route
                  </h2>
                  <p className="text-muted-foreground">{route.territory}</p>
                </div>
                <Badge className={getStatusColor(route.status)}>
                  {route.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary-hover">
              <Plus className="h-4 w-4 mr-2" />
              Add Stop
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Route Info */}
        <div className="space-y-6">
          {/* Route Details Card */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{formatDate(route.date)}</span>
              </div>
              {route.assigned_user && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">{route.assigned_user.name}</span>
                    </div>
                    {route.assigned_user.phone && (
                      <a 
                        href={`tel:${route.assigned_user.phone}`}
                        className="text-sm text-muted-foreground hover:underline ml-6"
                      >
                        {route.assigned_user.phone}
                      </a>
                    )}
                  </div>
                </>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{completedStops} of {stops.length}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Route Actions */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Navigation className="h-4 w-4 mr-2" />
                Open in Maps
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <User className="h-4 w-4 mr-2" />
                Assign Worker
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Edit Schedule
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stops List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Route Stops</h3>
            <Badge variant="outline">
              {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
            </Badge>
          </div>

          {stops.length > 0 ? (
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <Card
                  key={stop.id}
                  className={`glass-card border-border/50 hover-lift cursor-pointer ${
                    stop.status === 'completed' ? 'opacity-60' : ''
                  }`}
                  onClick={() => navigate(`/stores/${stop.store.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Stop Number */}
                      <div className="flex flex-col items-center gap-2">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold border-2 ${
                          stop.status === 'completed' 
                            ? 'bg-green-500/10 border-green-500 text-green-500'
                            : 'bg-primary/10 border-primary text-primary'
                        }`}>
                          {stop.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>
                        {index < stops.length - 1 && (
                          <div className="h-12 w-0.5 bg-border" />
                        )}
                      </div>

                      {/* Stop Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-lg">{stop.store.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {stop.store.address_street}, {stop.store.address_city}
                              </span>
                            </div>
                          </div>
                          <Badge className={
                            stop.status === 'completed' 
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                          }>
                            {stop.status}
                          </Badge>
                        </div>

                        {stop.notes_to_worker && (
                          <div className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded">
                            📝 {stop.notes_to_worker}
                          </div>
                        )}

                        {stop.status !== 'completed' && (
                          <Button 
                            size="sm" 
                            className="mt-2 bg-primary hover:bg-primary-hover"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Open visit logging modal
                              toast.info('Visit logging coming soon!');
                            }}
                          >
                            Log Visit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card border-border/50">
              <CardContent className="text-center py-12">
                <Circle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No stops added to this route yet</p>
                <Button className="mt-4" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Stop
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteDetail;
