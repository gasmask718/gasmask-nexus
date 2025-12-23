import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CheckCircle, 
  XCircle, 
  Voicemail, 
  PhoneOff, 
  Calendar as CalendarIcon,
  Ban,
  MessageSquare,
  Mail,
  Phone
} from "lucide-react";
import { useCreateDisposition } from "@/hooks/useWorkOwnership";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CallDispositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLogId: string;
  businessName?: string;
  onComplete?: () => void;
}

const DISPOSITION_CODES = [
  { code: "completed", label: "Completed", icon: CheckCircle, color: "text-green-500" },
  { code: "no-answer", label: "No Answer", icon: XCircle, color: "text-gray-500" },
  { code: "voicemail", label: "Left Voicemail", icon: Voicemail, color: "text-blue-500" },
  { code: "busy", label: "Busy", icon: PhoneOff, color: "text-orange-500" },
  { code: "callback", label: "Callback Scheduled", icon: CalendarIcon, color: "text-purple-500" },
  { code: "wrong-number", label: "Wrong Number", icon: Ban, color: "text-red-500" },
  { code: "dnc", label: "Do Not Call", icon: Ban, color: "text-red-600" },
];

const REASON_CATEGORIES = [
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "billing", label: "Billing" },
  { value: "delivery", label: "Delivery" },
  { value: "general", label: "General Inquiry" },
  { value: "other", label: "Other" },
];

export function CallDispositionModal({
  open,
  onOpenChange,
  callLogId,
  businessName,
  onComplete,
}: CallDispositionModalProps) {
  const [dispositionCode, setDispositionCode] = useState("");
  const [reasonCategory, setReasonCategory] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpType, setFollowUpType] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [recordingConsent, setRecordingConsent] = useState<boolean | undefined>(undefined);

  const createDisposition = useCreateDisposition();

  const handleSubmit = async () => {
    if (!dispositionCode) return;

    await createDisposition.mutateAsync({
      call_log_id: callLogId,
      business_name: businessName,
      disposition_code: dispositionCode,
      reason_category: reasonCategory || undefined,
      follow_up_required: followUpRequired,
      follow_up_type: followUpRequired ? followUpType : undefined,
      follow_up_scheduled_at: followUpRequired && followUpDate ? followUpDate.toISOString() : undefined,
      notes: notes || undefined,
      recording_consent_given: recordingConsent,
    });

    // Reset form
    setDispositionCode("");
    setReasonCategory("");
    setFollowUpRequired(false);
    setFollowUpType("");
    setFollowUpDate(undefined);
    setNotes("");
    setRecordingConsent(undefined);

    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Call Disposition</DialogTitle>
          <DialogDescription>
            Record the outcome of this call. This is required before closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Disposition Code */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Call Outcome *</Label>
            <RadioGroup value={dispositionCode} onValueChange={setDispositionCode}>
              <div className="grid grid-cols-2 gap-2">
                {DISPOSITION_CODES.map((disposition) => {
                  const Icon = disposition.icon;
                  return (
                    <label
                      key={disposition.code}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                        dispositionCode === disposition.code
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={disposition.code} className="sr-only" />
                      <Icon className={cn("h-5 w-5", disposition.color)} />
                      <span className="text-sm font-medium">{disposition.label}</span>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Reason Category */}
          <div className="space-y-2">
            <Label>Reason for Call</Label>
            <Select value={reasonCategory} onValueChange={setReasonCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recording Consent */}
          <div className="space-y-2">
            <Label>Recording Consent</Label>
            <RadioGroup
              value={recordingConsent === undefined ? "" : recordingConsent ? "yes" : "no"}
              onValueChange={(v) => setRecordingConsent(v === "yes")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="yes" />
                <span className="text-sm">Consent Given</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="no" />
                <span className="text-sm">No Consent</span>
              </label>
            </RadioGroup>
          </div>

          {/* Follow-up Required */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="followup"
                checked={followUpRequired}
                onCheckedChange={(checked) => setFollowUpRequired(checked === true)}
              />
              <Label htmlFor="followup">Follow-up Required</Label>
            </div>

            {followUpRequired && (
              <div className="pl-6 space-y-3">
                <div className="space-y-2">
                  <Label>Follow-up Type</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "call", icon: Phone, label: "Call" },
                      { value: "sms", icon: MessageSquare, label: "SMS" },
                      { value: "email", icon: Mail, label: "Email" },
                    ].map((type) => {
                      const Icon = type.icon;
                      return (
                        <Button
                          key={type.value}
                          type="button"
                          variant={followUpType === type.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFollowUpType(type.value)}
                        >
                          <Icon className="h-4 w-4 mr-1" />
                          {type.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Schedule For</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !followUpDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {followUpDate ? format(followUpDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={followUpDate}
                        onSelect={setFollowUpDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add any relevant notes about this call..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!dispositionCode || createDisposition.isPending}>
            Save Disposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
