/**
 * Ambassador Routes Page
 * Real data from useAmbassadorRoutes hook - weekly route planner with stop management
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, Calendar, Clock, Plus, ChevronRight, 
  CheckCircle, XCircle, Navigation, GripVertical,
  Store, Phone, Loader2
} from 'lucide-react';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { useAmbassadorRoutes, type AmbassadorRoute, type RouteStop } from '@/hooks/useAmbassadorRoutes';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';

export default function AmbassadorRoutes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stores } = useAmbassadorPortfolio();
  const { routes, isLoading, createRoute, isCreatingRoute, addStop, isAddingStop, completeStop, isCompletingStop } = useAmbassadorRoutes();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [completeStopOpen, setCompleteStopOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<AmbassadorRoute | null>(null);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);

  // Form state
  const [newRoute, setNewRoute] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [outcomeNotes, setOutcomeNotes] = useState('');

  // Generate week days
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const todaysRoute = routes.find(r => isSameDay(new Date(r.route_date), selectedDate));
  const completedStops = todaysRoute?.completed_stops || 0;
  const totalStops = todaysRoute?.stops_count || 0;

  const handleCreateRoute = async () => {
    if (!newRoute.title.trim()) {
      toast.error(t('amb.routes.toast_name_required'));
      return;
    }
    try {
      await createRoute({ title: newRoute.title, date: newRoute.date });
      setCreateRouteOpen(false);
      setNewRoute({ title: '', date: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleAddStop = async () => {
    if (!selectedRoute || !selectedStoreId) {
      toast.error(t('amb.routes.toast_store_required'));
      return;
    }
    try {
      await addStop({ routeId: selectedRoute.id, storeId: selectedStoreId });
      setAddStopOpen(false);
      setSelectedStoreId('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleCompleteStop = async (status: 'complete' | 'skipped') => {
    if (!selectedStop) return;
    try {
      await completeStop({ stopId: selectedStop.id, status, notes: outcomeNotes });
      setCompleteStopOpen(false);
      setOutcomeNotes('');
      setSelectedStop(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const openAddStop = (route: AmbassadorRoute) => {
    setSelectedRoute(route);
    setAddStopOpen(true);
  };

  const openCompleteStop = (stop: RouteStop) => {
    setSelectedStop(stop);
    setCompleteStopOpen(true);
  };

  const navigateToStore = (storeId: string | null) => {
    if (storeId) {
      navigate(`/ambassador/stores/${storeId}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'skipped':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <AmbassadorLayout 
        title={t("amb.routes.title")} 
        subtitle={t("amb.routes.subtitle")}
        backPath="/ambassador/dashboard"
      >
        <div className="p-6 space-y-6">
          <Skeleton className="h-32" />
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="md:col-span-2 h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </AmbassadorLayout>
    );
  }

  return (
    <AmbassadorLayout 
      title={t("amb.routes.title")} 
      subtitle={t("amb.routes.subtitle")}
      backPath="/ambassador/dashboard"
    >
      <div className="p-6 space-y-6">
        {/* Week Calendar Strip */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold"><BilingualLabel tKey="amb.routes.week_of" en="Week of" inline /> {format(weekStart, 'MMMM d, yyyy')}</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                >
                  {t('amb.routes.previous')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                >
                  {t('amb.routes.today')}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                >
                  {t('amb.routes.next')}
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
                  {todaysRoute?.title || `${t('amb.routes.route_for')} ${format(selectedDate, 'EEEE, MMM d')}`}
                </CardTitle>
                <CardDescription>
                  {todaysRoute 
                    ? `${completedStops} ${t('amb.routes.stops_of')} ${totalStops} ${t('amb.routes.completed_suffix')}`
                    : t('amb.routes.no_route_today')
                  }
                </CardDescription>
              </div>
              {todaysRoute && (
                <Button onClick={() => openAddStop(todaysRoute)}>
                  <Plus className="h-4 w-4 mr-2" />
                  <BilingualLabel tKey="amb.routes.add_stop" en="Add Stop" inline />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {todaysRoute && todaysRoute.stops && todaysRoute.stops.length > 0 ? (
                <div className="space-y-2">
                  {todaysRoute.stops.sort((a, b) => a.planned_order - b.planned_order).map((stop) => (
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

                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigateToStore(stop.store_id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stop.store_name || stop.custom_address || `Stop #${stop.planned_order}`}</span>
                          {stop.planned_time && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {stop.planned_time}
                            </Badge>
                          )}
                        </div>
                        {stop.store_address && (
                          <p className="text-sm text-muted-foreground mt-1">{stop.store_address}</p>
                        )}
                        {stop.outcome_notes && (
                          <p className="text-sm text-muted-foreground mt-1">{stop.outcome_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {stop.status === 'planned' ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => navigateToStore(stop.store_id)}>
                              <Store className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={() => openCompleteStop(stop)}>
                              {t('amb.routes.complete')}
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => navigateToStore(stop.store_id)}>
                            {t('amb.routes.view_details')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : todaysRoute ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2"><BilingualLabel tKey="amb.routes.no_stops_yet" en="No Stops Yet" /></h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <BilingualLabel tKey="amb.routes.add_stores_to_route" en="Add stores to your route" />
                  </p>
                  <Button onClick={() => openAddStop(todaysRoute)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stop
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2"><BilingualLabel tKey="amb.routes.no_route_planned" en="No Route Planned" /></h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    <BilingualLabel tKey="amb.routes.create_route_help" en="Create a route for this day to optimize your store visits" />
                  </p>
                  <Button onClick={() => {
                    setNewRoute({ ...newRoute, date: format(selectedDate, 'yyyy-MM-dd') });
                    setCreateRouteOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    <BilingualLabel tKey="amb.routes.create_route" en="Create Route" inline />
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
                  <p className="text-sm text-muted-foreground"><BilingualLabel tKey="amb.routes.stops_completed" en="Stops Completed" /></p>
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
                <CardTitle className="text-sm"><BilingualLabel tKey="amb.routes.available_stores" en="Available Stores" /></CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {stores && stores.length > 0 ? (
                      stores.slice(0, 10).map((store) => (
                        <div 
                          key={store.store_id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => navigateToStore(store.store_id)}
                        >
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[120px]">{store.store_name}</span>
                          </div>
                          {todaysRoute && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRoute(todaysRoute);
                                setSelectedStoreId(store.store_id);
                                addStop({ routeId: todaysRoute.id, storeId: store.store_id });
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('amb.routes.no_stores_assigned')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Route History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg"><BilingualLabel tKey="amb.routes.recent_routes" en="Recent Routes" /></CardTitle>
            <CardDescription><BilingualLabel tKey="amb.routes.past_routes" en="Your past routes and visit history" /></CardDescription>
          </CardHeader>
          <CardContent>
            {routes.length > 0 ? (
              <div className="space-y-3">
                {routes.slice(0, 10).map((route) => (
                  <div 
                    key={route.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedDate(new Date(route.route_date))}
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
                        {route.completed_stops}/{route.stops_count} {t('amb.routes.stops_completed_count')}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p><BilingualLabel tKey="amb.routes.no_routes" en="No routes yet" /></p>
                <p className="text-sm"><BilingualLabel tKey="amb.routes.first_route" en="Create your first route to get started" /></p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Route Modal */}
      <Dialog open={createRouteOpen} onOpenChange={setCreateRouteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><BilingualLabel tKey="amb.routes.create_new_route" en="Create New Route" /></DialogTitle>
            <DialogDescription>
              <BilingualLabel tKey="amb.routes.plan_visits" en="Plan your store visits for the day" />
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label><BilingualLabel tKey="amb.routes.route_name" en="Route Name" /></Label>
              <Input 
                value={newRoute.title}
                onChange={(e) => setNewRoute({ ...newRoute, title: e.target.value })}
                placeholder={t('amb.routes.route_name')}
              />
            </div>

            <div className="space-y-2">
              <Label><BilingualLabel tKey="amb.routes.date" en="Date" /></Label>
              <Input 
                type="date"
                value={newRoute.date}
                onChange={(e) => setNewRoute({ ...newRoute, date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRouteOpen(false)}>{t('amb.routes.cancel')}</Button>
            <Button onClick={handleCreateRoute} disabled={isCreatingRoute}>
              {isCreatingRoute && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('amb.routes.create_route')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stop Modal */}
      <Dialog open={addStopOpen} onOpenChange={setAddStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><BilingualLabel tKey="amb.routes.add_stop_to_route" en="Add Stop to Route" /></DialogTitle>
            <DialogDescription>
              <BilingualLabel tKey="amb.routes.select_store_help" en="Select a store to add to your route" />
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label><BilingualLabel tKey="amb.routes.select_store" en="Select Store" /></Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('amb.routes.choose_store')} />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.store_id} value={store.store_id}>
                      {store.store_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStopOpen(false)}>{t('amb.routes.cancel')}</Button>
            <Button onClick={handleAddStop} disabled={isAddingStop || !selectedStoreId}>
              {isAddingStop && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('amb.routes.add_stop')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Stop Modal */}
      <Dialog open={completeStopOpen} onOpenChange={setCompleteStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><BilingualLabel tKey="amb.routes.complete_stop" en="Complete Stop" /></DialogTitle>
            <DialogDescription>
              <BilingualLabel tKey="amb.routes.record_outcome" en="Record the outcome of your visit" />
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label><BilingualLabel tKey="amb.routes.outcome_notes" en="Outcome Notes" /></Label>
              <Textarea 
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder={t('amb.routes.what_happened')}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCompleteStopOpen(false)}>{t('amb.routes.cancel')}</Button>
            <Button 
              variant="destructive" 
              onClick={() => handleCompleteStop('skipped')}
              disabled={isCompletingStop}
            >
              {isCompletingStop && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <XCircle className="h-4 w-4 mr-2" />
              {t('amb.routes.skip')}
            </Button>
            <Button onClick={() => handleCompleteStop('complete')} disabled={isCompletingStop}>
              {isCompletingStop && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('amb.routes.complete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AmbassadorLayout>
  );
}
