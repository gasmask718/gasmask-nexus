import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, User, Truck, Bike, Clock } from 'lucide-react';

interface Route {
  id: string;
  date: string;
  type: string;
  territory: string;
  status: string;
  assigned_to: string | null;
}

const Routes = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'driver' | 'biker'>('all');

  useEffect(() => {
    const fetchRoutes = async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching routes:', error);
      } else {
        setRoutes(data || []);
      }
      setLoading(false);
    };

    fetchRoutes();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
    }
  };

  const filteredRoutes = routes.filter(route => 
    filter === 'all' || route.type === filter
  );

  const todayRoutes = filteredRoutes.filter(r => 
    new Date(r.date).toDateString() === new Date().toDateString()
  );
  const upcomingRoutes = filteredRoutes.filter(r => 
    new Date(r.date) > new Date() && new Date(r.date).toDateString() !== new Date().toDateString()
  );
  const pastRoutes = filteredRoutes.filter(r => 
    new Date(r.date) < new Date() && new Date(r.date).toDateString() !== new Date().toDateString()
  );

  const RouteCard = ({ route, index }: { route: Route; index: number }) => (
    <Card
      className="glass-card border-border/50 hover-lift hover-glow cursor-pointer"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => navigate(`/routes/${route.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              route.type === 'driver' ? 'bg-green-500/10' : 'bg-blue-500/10'
            }`}>
              {route.type === 'driver' ? (
                <Truck className={`h-5 w-5 ${
                  route.type === 'driver' ? 'text-green-500' : 'text-blue-500'
                }`} />
              ) : (
                <Bike className="h-5 w-5 text-blue-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg capitalize">{route.type} Route</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(route.date)}
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(route.status)}>
            {route.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {route.territory && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{route.territory}</span>
          </div>
        )}
        {route.assigned_to ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Assigned to driver</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Unassigned</span>
          </div>
        )}
        <Button 
          variant="outline" 
          className="w-full mt-4 border-border/50 hover:bg-secondary/80"
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Routes</h2>
          <p className="text-muted-foreground">
            Manage delivery and inventory check routes
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary-hover">
          + New Route
        </Button>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">All Routes</TabsTrigger>
          <TabsTrigger value="driver">
            <Truck className="h-4 w-4 mr-2" />
            Drivers
          </TabsTrigger>
          <TabsTrigger value="biker">
            <Bike className="h-4 w-4 mr-2" />
            Bikers
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Today's Routes */}
          {todayRoutes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Routes
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {todayRoutes.map((route, index) => (
                  <RouteCard key={route.id} route={route} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Routes */}
          {upcomingRoutes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Upcoming Routes
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingRoutes.map((route, index) => (
                  <RouteCard key={route.id} route={route} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Past Routes */}
          {pastRoutes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-muted-foreground">
                Past Routes
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pastRoutes.map((route, index) => (
                  <RouteCard key={route.id} route={route} index={index} />
                ))}
              </div>
            </div>
          )}

          {filteredRoutes.length === 0 && (
            <Card className="glass-card border-border/50">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No routes found for this filter</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Routes;
