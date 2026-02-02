import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Phone,
  Navigation,
  Camera,
  FileText,
  ChevronRight,
  Truck
} from "lucide-react";
import { useMyRouteToday, useDeliveryActions } from "@/hooks/useDeliveryExecution";
import StopExecutionCard from "@/components/delivery/StopExecutionCard";
import PODCaptureModal from "@/components/delivery/PODCaptureModal";
import ExceptionReportModal from "@/components/delivery/ExceptionReportModal";

export default function MyRouteToday() {
  const { data: routeData, isLoading } = useMyRouteToday();
  const { startRoute, completeRoute } = useDeliveryActions();
  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [showPODModal, setShowPODModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!routeData) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <Card className="p-12 text-center">
            <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Route Assigned</h2>
            <p className="text-muted-foreground">
              You don't have any routes assigned for today. Check back later or contact your dispatcher.
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  const { route, stops, stats } = routeData;
  const progressPercent = stats.totalStops > 0 
    ? Math.round((stats.completedStops / stats.totalStops) * 100) 
    : 0;

  const isRouteActive = route.status === 'in_progress' || route.route_state === 'active';
  const isRouteCompleted = route.status === 'completed' || route.route_state === 'completed';

  const handleStartRoute = () => {
    startRoute.mutate(route.id);
  };

  const handleCompleteRoute = () => {
    if (stats.pendingStops > 0) {
      const confirmed = window.confirm(
        `You still have ${stats.pendingStops} pending stops. Are you sure you want to complete this route?`
      );
      if (!confirmed) return;
    }
    completeRoute.mutate(route.id);
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-2xl">
        {/* Route Header */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">My Route Today</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {route.territory || 'General'} • {new Date(route.date).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={isRouteCompleted ? "secondary" : isRouteActive ? "default" : "outline"}>
                {isRouteCompleted ? 'Completed' : isRouteActive ? 'Active' : 'Not Started'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>{stats.completedStops} of {stats.totalStops} stops</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-500/10 rounded-lg p-2">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <div className="text-lg font-bold text-green-500">{stats.completedStops}</div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-2">
                <Clock className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
                <div className="text-lg font-bold text-yellow-500">{stats.pendingStops}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-2">
                <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <div className="text-lg font-bold text-red-500">{stats.skippedStops}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            {/* Route Actions */}
            <Separator className="my-4" />
            <div className="flex gap-2">
              {!isRouteActive && !isRouteCompleted && (
                <Button 
                  className="flex-1" 
                  onClick={handleStartRoute}
                  disabled={startRoute.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Route
                </Button>
              )}
              {isRouteActive && (
                <Button 
                  className="flex-1" 
                  variant="secondary"
                  onClick={handleCompleteRoute}
                  disabled={completeRoute.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Route
                </Button>
              )}
              <Button variant="outline" size="icon">
                <Navigation className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stops List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg px-1">Stops ({stops.length})</h3>
          {stops.map((stop: any, index: number) => (
            <StopExecutionCard
              key={stop.id}
              stop={stop}
              index={index + 1}
              isActive={isRouteActive}
              onComplete={() => {
                setSelectedStop(stop);
                setShowPODModal(true);
              }}
              onReportIssue={() => {
                setSelectedStop(stop);
                setShowExceptionModal(true);
              }}
            />
          ))}
        </div>

        {/* Modals */}
        {selectedStop && (
          <>
            <PODCaptureModal
              open={showPODModal}
              onClose={() => {
                setShowPODModal(false);
                setSelectedStop(null);
              }}
              stop={selectedStop}
            />
            <ExceptionReportModal
              open={showExceptionModal}
              onClose={() => {
                setShowExceptionModal(false);
                setSelectedStop(null);
              }}
              stop={selectedStop}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
