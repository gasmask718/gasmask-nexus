import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  ArrowLeft, Route, MapPin, Bike, Clock, 
  CheckCircle2, AlertTriangle, Navigation
} from 'lucide-react';

const RouteDetail: React.FC = () => {
  const { routeId } = useParams();
  const navigate = useNavigate();

  // Fetch route details with stops
  const { data: route, isLoading } = useQuery({
    queryKey: ['route-detail', routeId],
    queryFn: async () => {
      // Try to get from deliveries first
      const { data: delivery, error } = await supabase
        .from('deliveries')
        .select(`
          *
        `)
        .eq('id', routeId)
        .single();
      
      if (error) throw error;
      return delivery;
    },
    enabled: !!routeId
  });

  // Fetch stops for this route
  const { data: stops = [] } = useQuery({
    queryKey: ['route-stops', routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_stops')
        .select(`
          *,
          location:locations(id, name, address_line1, city)
        `)
        .eq('delivery_id', routeId)
        .order('stop_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!routeId
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Loading route...</div>
      </Layout>
    );
  }

  if (!route) {
    return (
      <Layout>
        <div className="p-6 text-center">
          <Route className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Route not found</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  const completedStops = stops.filter((s: any) => s.status === 'completed').length;
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-emerald-500',
      in_progress: 'bg-blue-500',
      scheduled: 'bg-amber-500',
      pending: 'bg-gray-400'
    };
    return colors[status] || colors.pending;
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Route className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Route #{routeId?.slice(-6)}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{route.scheduled_date ? format(new Date(route.scheduled_date), 'MMMM d, yyyy') : 'Not scheduled'}</span>
                </div>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="capitalize text-lg px-4 py-2">
            {route.status}
          </Badge>
        </div>

        {/* Route Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{stops.length}</div>
                  <p className="text-sm text-muted-foreground">Total Stops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <div className="text-2xl font-bold">{completedStops}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bike className="h-8 w-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold truncate max-w-24">
                    {route.assigned_driver_id ? 'Assigned' : 'Unassigned'}
                  </div>
                  <p className="text-sm text-muted-foreground">Driver</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Navigation className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stops List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Route Stops
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stops.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No stops on this route</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stops.map((stop: any, index: number) => (
                  <div 
                    key={stop.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => stop.location_id && navigate(`/delivery/store/${stop.location_id}`)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold">
                      {index + 1}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(stop.status)}`} />
                    <div className="flex-1">
                      <p className="font-medium">{stop.location?.name || 'Unknown Location'}</p>
                      <p className="text-sm text-muted-foreground">
                        {stop.location?.address_line1}, {stop.location?.city}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {stop.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/delivery/drivers')}>
            <Bike className="h-4 w-4 mr-2" />
            Reassign Driver
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/delivery/biker-tasks')}>
            <MapPin className="h-4 w-4 mr-2" />
            Add Stop
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default RouteDetail;
