import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Truck, MapPin, Package, Clock, Play, 
  AlertTriangle, DollarSign, CheckCircle2, Navigation
} from 'lucide-react';

const DriverHome: React.FC = () => {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's deliveries
  const { data: todaysDeliveries = [], isLoading } = useQuery({
    queryKey: ['driver-deliveries-today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          delivery_stops (*)
        `)
        .eq('scheduled_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Calculate stats
  const totalDeliveries = todaysDeliveries.length;
  const totalStops = todaysDeliveries.reduce((sum, d) => sum + (d.delivery_stops?.length || 0), 0);
  const completedStops = todaysDeliveries.reduce((sum, d) => 
    sum + (d.delivery_stops?.filter((s: any) => s.status === 'completed').length || 0), 0);
  const pendingStops = totalStops - completedStops;
  
  // Alerts: stops with amount_due or tight time windows
  const alerts = todaysDeliveries.flatMap(d => 
    d.delivery_stops?.filter((s: any) => 
      s.amount_due > 0 || (s.window_end && new Date(`${today}T${s.window_end}`) < new Date(Date.now() + 60 * 60 * 1000))
    ) || []
  );

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      normal: 'secondary',
      high: 'default',
      urgent: 'destructive'
    };
    return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      scheduled: 'secondary',
      in_progress: 'default',
      completed: 'default',
      cancelled: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Driver Home
            </h1>
            <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalDeliveries}</div>
                  <p className="text-sm text-muted-foreground">Deliveries</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{pendingStops}</div>
                  <p className="text-sm text-muted-foreground">Stops Left</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
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
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{alerts.length}</div>
                  <p className="text-sm text-muted-foreground">Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Panel */}
        {alerts.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="h-5 w-5" />
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((stop: any, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
                    <div className="flex items-center gap-2">
                      {stop.amount_due > 0 && (
                        <Badge variant="outline" className="text-yellow-700">
                          <DollarSign className="h-3 w-3 mr-1" />${stop.amount_due}
                        </Badge>
                      )}
                      {stop.window_end && (
                        <Badge variant="outline" className="text-orange-700">
                          <Clock className="h-3 w-3 mr-1" />Due by {stop.window_end}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>My Deliveries Today</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : todaysDeliveries.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deliveries scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todaysDeliveries.map((delivery: any) => {
                  const stopsCompleted = delivery.delivery_stops?.filter((s: any) => s.status === 'completed').length || 0;
                  const totalDeliveryStops = delivery.delivery_stops?.length || 0;
                  
                  return (
                    <div 
                      key={delivery.id} 
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{delivery.id.slice(0, 8)}
                            </span>
                            {getStatusBadge(delivery.status)}
                            {getPriorityBadge(delivery.priority)}
                            <Badge variant="outline">{delivery.delivery_type}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {stopsCompleted}/{totalDeliveryStops} stops
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {delivery.scheduled_date}
                            </span>
                          </div>
                          {delivery.dispatcher_notes && (
                            <p className="text-sm bg-muted p-2 rounded">{delivery.dispatcher_notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {delivery.status === 'scheduled' && (
                            <Button 
                              size="lg" 
                              className="flex-1 md:flex-none"
                              onClick={() => navigate(`/delivery/my-route/${delivery.id}`)}
                            >
                              <Play className="h-4 w-4 mr-2" /> Start Route
                            </Button>
                          )}
                          {delivery.status === 'in_progress' && (
                            <Button 
                              size="lg" 
                              variant="secondary"
                              className="flex-1 md:flex-none"
                              onClick={() => navigate(`/delivery/my-route/${delivery.id}`)}
                            >
                              <Navigation className="h-4 w-4 mr-2" /> Continue Route
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {totalDeliveryStops > 0 ? Math.round((stopsCompleted / totalDeliveryStops) * 100) : 0}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${totalDeliveryStops > 0 ? (stopsCompleted / totalDeliveryStops) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/delivery/my-route')}
          >
            <Navigation className="h-6 w-6" />
            <span>View All Routes</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/delivery/payouts')}
          >
            <DollarSign className="h-6 w-6" />
            <span>My Payouts</span>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default DriverHome;
