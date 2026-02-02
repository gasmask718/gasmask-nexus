import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Camera, Send } from "lucide-react";
import { useDeliveryActions } from "@/hooks/useDeliveryExecution";
import { toast } from "sonner";

interface ExceptionReportModalProps {
  open: boolean;
  onClose: () => void;
  stop: any;
}

const EXCEPTION_TYPES = [
  { value: 'customer_unavailable', label: 'Customer Unavailable' },
  { value: 'wrong_address', label: 'Wrong Address' },
  { value: 'refused_delivery', label: 'Delivery Refused' },
  { value: 'damaged_goods', label: 'Damaged Goods' },
  { value: 'missing_items', label: 'Missing Items' },
  { value: 'vehicle_issue', label: 'Vehicle Issue' },
  { value: 'weather', label: 'Weather Conditions' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low - Minor issue', color: 'text-blue-500' },
  { value: 'medium', label: 'Medium - Needs attention', color: 'text-yellow-500' },
  { value: 'high', label: 'High - Delivery failed', color: 'text-orange-500' },
  { value: 'critical', label: 'Critical - Immediate action', color: 'text-red-500' },
];

export default function ExceptionReportModal({ open, onClose, stop }: ExceptionReportModalProps) {
  const { reportException, updateStopStatus } = useDeliveryActions();
  const [exceptionType, setExceptionType] = useState<string>("");
  const [severity, setSeverity] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [photosTaken, setPhotosTaken] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTakePhoto = () => {
    // In a real app, this would open the camera
    setPhotosTaken(prev => prev + 1);
    toast.success(`Photo ${photosTaken + 1} captured`);
  };

  const handleSubmit = async () => {
    if (!exceptionType) {
      toast.error("Please select an exception type");
      return;
    }
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    setIsSubmitting(true);
    try {
      // Report the exception
      if (stop.delivery_id) {
        await reportException.mutateAsync({
          deliveryId: stop.delivery_id,
          exceptionType,
          severity,
          description,
          photoUrls: photosTaken > 0 ? Array(photosTaken).fill('captured') : undefined,
        });
      }

      // Update stop status based on severity
      if (severity === 'high' || severity === 'critical') {
        await updateStopStatus.mutateAsync({
          stopId: stop.id,
          status: 'skipped',
          notes: `Exception: ${exceptionType} - ${description}`,
        });
      }

      toast.success("Exception reported successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to report exception");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Report Issue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Store Info */}
          <div className="bg-muted rounded-lg p-3">
            <p className="font-medium">{stop.store?.name || 'Unknown Store'}</p>
            <p className="text-sm text-muted-foreground">
              {stop.store?.address_street}, {stop.store?.address_city}
            </p>
          </div>

          {/* Exception Type */}
          <div>
            <Label className="text-sm font-medium">Issue Type *</Label>
            <Select value={exceptionType} onValueChange={setExceptionType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <Label className="text-sm font-medium">Severity *</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <span className={level.color}>{level.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Photo Evidence */}
          <div>
            <Label className="text-sm font-medium">Photo Evidence (Optional)</Label>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleTakePhoto}
            >
              <Camera className="h-4 w-4 mr-2" />
              {photosTaken > 0 ? `${photosTaken} Photo(s) Captured - Add More` : 'Take Photo'}
            </Button>
          </div>

          {/* Severity Warning */}
          {(severity === 'high' || severity === 'critical') && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-500">
                ⚠️ High/Critical severity will mark this stop as skipped and notify dispatch.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !exceptionType || !description.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
