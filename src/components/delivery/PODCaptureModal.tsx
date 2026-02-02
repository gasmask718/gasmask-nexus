import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Check, PenTool } from "lucide-react";
import { useDeliveryActions } from "@/hooks/useDeliveryExecution";
import { toast } from "sonner";

interface PODCaptureModalProps {
  open: boolean;
  onClose: () => void;
  stop: any;
}

export default function PODCaptureModal({ open, onClose, stop }: PODCaptureModalProps) {
  const { updateStopStatus, capturePOD } = useDeliveryActions();
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoTaken, setPhotoTaken] = useState(false);
  const [signatureCaptured, setSignatureCaptured] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTakePhoto = () => {
    // In a real app, this would open the camera
    // For now, we'll simulate photo capture
    setPhotoTaken(true);
    toast.success("Photo captured");
  };

  const handleCaptureSignature = () => {
    // In a real app, this would open a signature pad
    // For now, we'll simulate signature capture
    setSignatureCaptured(true);
    toast.success("Signature captured");
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Update the stop status
      await updateStopStatus.mutateAsync({
        stopId: stop.id,
        status: 'completed',
        notes: notes || undefined,
      });

      // If there's a delivery associated, capture POD
      if (stop.delivery_id) {
        await capturePOD.mutateAsync({
          deliveryId: stop.delivery_id,
          photoUrl: photoTaken ? 'captured' : undefined,
          signatureUrl: signatureCaptured ? 'captured' : undefined,
          recipientName: recipientName || undefined,
          notes: notes || undefined,
        });
      }

      toast.success("Stop completed successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to complete stop");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickComplete = async () => {
    setIsSubmitting(true);
    try {
      await updateStopStatus.mutateAsync({
        stopId: stop.id,
        status: 'completed',
      });
      toast.success("Stop marked complete");
      onClose();
    } catch (error) {
      toast.error("Failed to complete stop");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Delivery</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Store Info */}
          <div className="bg-muted rounded-lg p-3">
            <p className="font-medium">{stop.store?.name || 'Unknown Store'}</p>
            <p className="text-sm text-muted-foreground">
              {stop.store?.address_street}, {stop.store?.address_city}
            </p>
          </div>

          {/* Photo Capture */}
          <div>
            <Label className="text-sm font-medium">Photo Proof</Label>
            <Button
              variant={photoTaken ? "secondary" : "outline"}
              className="w-full mt-2"
              onClick={handleTakePhoto}
            >
              {photoTaken ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Photo Captured
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </>
              )}
            </Button>
          </div>

          {/* Signature */}
          <div>
            <Label className="text-sm font-medium">Signature (Optional)</Label>
            <Button
              variant={signatureCaptured ? "secondary" : "outline"}
              className="w-full mt-2"
              onClick={handleCaptureSignature}
            >
              {signatureCaptured ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Signature Captured
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4 mr-2" />
                  Capture Signature
                </>
              )}
            </Button>
          </div>

          {/* Recipient Name */}
          <div>
            <Label htmlFor="recipientName" className="text-sm font-medium">
              Recipient Name (Optional)
            </Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Who received the delivery?"
              className="mt-2"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              className="mt-2"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleComplete} 
            disabled={isSubmitting}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Complete with POD
          </Button>
          <Button 
            variant="outline" 
            onClick={handleQuickComplete}
            disabled={isSubmitting}
            className="w-full"
          >
            Quick Complete (No POD)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
