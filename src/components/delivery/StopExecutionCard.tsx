import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ChevronRight
} from "lucide-react";
import { useDeliveryActions } from "@/hooks/useDeliveryExecution";
import { useCall } from "@/components/communication/CallProvider";

interface StopExecutionCardProps {
  stop: any;
  index: number;
  isActive: boolean;
  onComplete: () => void;
  onReportIssue: () => void;
}

export default function StopExecutionCard({
  stop,
  index,
  isActive,
  onComplete,
  onReportIssue,
}: StopExecutionCardProps) {
  const { updateStopStatus } = useDeliveryActions();
  const { initiateCall } = useCall();
  const store = stop.store;
  
  const isCompleted = stop.status === 'completed';
  const isSkipped = stop.status === 'skipped';
  const isPending = stop.status === 'pending' || !stop.status;

  const getStatusBadge = () => {
    if (isCompleted) {
      return <Badge variant="secondary" className="bg-green-500/20 text-green-500">Completed</Badge>;
    }
    if (isSkipped) {
      return <Badge variant="secondary" className="bg-red-500/20 text-red-500">Skipped</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const handleNavigate = () => {
    if (store?.lat && store?.lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`,
        '_blank'
      );
    } else if (store?.address_street && store?.address_city) {
      const address = encodeURIComponent(`${store.address_street}, ${store.address_city}`);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
    }
  };

  const handleCall = () => {
    if (store?.phone) {
      window.open(`tel:${store.phone}`, '_self');
    }
  };

  const handleSkip = () => {
    updateStopStatus.mutate({
      stopId: stop.id,
      status: 'skipped',
      notes: 'Skipped by driver',
    });
  };

  return (
    <Card className={`transition-all ${isCompleted ? 'opacity-60' : ''} ${isSkipped ? 'border-red-500/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Stop Number */}
          <div className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            ${isCompleted ? 'bg-green-500 text-white' : isSkipped ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}
          `}>
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index}
          </div>

          {/* Stop Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold truncate">{store?.name || 'Unknown Store'}</h4>
              {getStatusBadge()}
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">
                {store?.address_street ? `${store.address_street}, ${store.address_city}` : 'No address'}
              </span>
            </div>

            {/* Delivery Info */}
            {stop.delivery_type && (
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  {stop.delivery_type}
                </Badge>
                {stop.priority === 'urgent' && (
                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNavigate}
                className="flex-1"
              >
                <Navigation className="h-3 w-3 mr-1" />
                Navigate
              </Button>
              {store?.phone && (
                <Button variant="outline" size="sm" onClick={handleCall}>
                  <Phone className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Execution Actions */}
            {isActive && isPending && (
              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={onComplete}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onReportIssue}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Issue
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSkip}
                  disabled={updateStopStatus.isPending}
                >
                  Skip
                </Button>
              </div>
            )}

            {/* Completion Time */}
            {isCompleted && stop.actual_arrival && (
              <div className="flex items-center text-xs text-green-600 mt-2">
                <Clock className="h-3 w-3 mr-1" />
                Completed at {new Date(stop.actual_arrival).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
