/**
 * Ambassador Routes Page
 * Weekly route planner with stop management and visit execution
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MapPin, Calendar, Clock, Plus, ChevronRight, 
  CheckCircle, XCircle, Navigation, GripVertical,
  Store, Building, Phone, MessageSquare
} from 'lucide-react';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';

interface RouteStop {
  id: string;
  store_id?: string;
  store_name?: string;
  custom_address?: string;
  planned_time?: string;
  status: 'planned' | 'complete' | 'skipped';
  outcome_notes?: string;
  order: number;
}

interface Route {
  id: string;
  route_date: string;
  title: string;
  stops: RouteStop[];
}

export default function AmbassadorRoutes() {
  const { stores } = useAmbassadorPortfolio();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddStop, setShowAddStop] = useState(false);

  // Generate week days
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Mock route data - will be replaced with real data
  const routes: Route[] = [
    {
      id: 'route-1',
      route_date: format(new Date(), 'yyyy-MM-dd'),
      title: 'Manhattan Route',
      stops: [
        {
          id: 'stop-1',
          store_id: '1',
          store_name: 'Quick Stop Deli',
          planned_time: '09:00',
          status: 'complete',
          order: 1,
          outcome_notes: 'Restocked, took new order'
        },
        {
          id: 'stop-2',
          store_id: '2',
          store_name: 'Corner Bodega',
          planned_time: '10:30',
          status: 'complete',
          order: 2,
        },
        {
          id: 'stop-3',
          store_id: '3',
          store_name: 'Uptown Grocery',
          planned_time: '12:00',
          status: 'planned',
          order: 3,
        },
        {
          id: 'stop-4',
          store_id: '4',
          store_name: 'City Mart',
          planned_time: '14:00',
          status: 'planned',
          order: 4,
        },
      ]
    },
  ];

  const todaysRoute = routes.find(r => isSameDay(new Date(r.route_date), selectedDate));
  const completedStops = todaysRoute?.stops.filter(s => s.status === 'complete').length || 0;
  const totalStops = todaysRoute?.stops.length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'skipped':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <EnhancedPortalLayout 
      title="Route Planner" 
      subtitle="Plan visits, optimize routes, and track outcomes"
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Week Calendar Strip */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Week of {format(weekStart, 'MMMM d, yyyy')}</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const hasRoute = routes.some(r => isSameDay(new Date(r.route_date), day));
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      p-3 rounded-lg text-center transition-all
                      ${isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                      }
                      ${isToday && !isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                    `}
                  >
                    <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                    <div className="text-lg font-semibold">{format(day, 'd')}</div>
                    {hasRoute && (
                      <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Today's Route Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">
                  {todaysRoute?.title || `Route for ${format(selectedDate, 'EEEE, MMM d')}`}
                </CardTitle>
                <CardDescription>
                  {todaysRoute 
                    ? `${completedStops} of ${totalStops} stops completed`
                    : 'No route planned for this day'
                  }
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddStop(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            </CardHeader>
            <CardContent>
              {todaysRoute ? (
                <div className="space-y-2">
                  {todaysRoute.stops.map((stop, index) => (
                    <div 
                      key={stop.id}
                      className={`
                        flex items-center gap-4 p-4 rounded-lg border transition-all
                        ${stop.status === 'complete' ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/50'}
                      `}
                    >
                      <div className="cursor-move">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-shrink-0">
                        {getStatusIcon(stop.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stop.store_name || stop.custom_address}</span>
                          {stop.planned_time && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {stop.planned_time}
                            </Badge>
                          )}
                        </div>
                        {stop.outcome_notes && (
                          <p className="text-sm text-muted-foreground mt-1">{stop.outcome_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {stop.status === 'planned' && (
                          <>
                            <Button variant="ghost" size="icon">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Navigation className="h-4 w-4" />
                            </Button>
                            <Button size="sm">
                              Start Visit
                            </Button>
                          </>
                        )}
                        {stop.status === 'complete' && (
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Route Planned</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a route for this day to optimize your store visits
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Route
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">{completedStops}/{totalStops}</div>
                  <p className="text-sm text-muted-foreground">Stops Completed</p>
                </div>
                <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: totalStops ? `${(completedStops / totalStops) * 100}%` : '0%' }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Available Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {stores?.slice(0, 5).map((store, index) => (
                      <div 
                        key={store.store_id || index}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{store.store_name}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Route History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Routes</CardTitle>
            <CardDescription>Your past routes and visit history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {routes.map((route) => (
                <div 
                  key={route.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{route.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(route.route_date), 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">
                      {route.stops.filter(s => s.status === 'complete').length}/{route.stops.length} completed
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </EnhancedPortalLayout>
  );
}
