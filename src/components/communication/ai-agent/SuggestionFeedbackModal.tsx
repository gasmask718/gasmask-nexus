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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { SuggestionFeedback } from "@/hooks/useAssistedModeSuggestions";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react";

interface SuggestionFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictionId: string;
  suggestedResponse: string;
  onSubmit: (feedback: SuggestionFeedback) => void;
}

const ratingOptions = [
  { 
    value: 'accurate', 
    label: 'Accurate', 
    description: 'The suggestion was helpful and correct',
    icon: CheckCircle2,
    color: 'text-green-500'
  },
  { 
    value: 'helpful_incomplete', 
    label: 'Helpful but incomplete', 
    description: 'Useful direction but needed more detail',
    icon: HelpCircle,
    color: 'text-yellow-500'
  },
  { 
    value: 'inaccurate', 
    label: 'Inaccurate', 
    description: 'The suggestion missed the point',
    icon: XCircle,
    color: 'text-orange-500'
  },
  { 
    value: 'misleading', 
    label: 'Misleading', 
    description: 'The suggestion could have caused problems',
    icon: AlertTriangle,
    color: 'text-destructive'
  },
] as const;

export function SuggestionFeedbackModal({
  open,
  onOpenChange,
  predictionId,
  suggestedResponse,
  onSubmit,
}: SuggestionFeedbackModalProps) {
  const [rating, setRating] = useState<SuggestionFeedback['rating']>('accurate');
  const [humanOverrode, setHumanOverrode] = useState(false);
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    onSubmit({
      predictionId,
      rating,
      humanOverrode,
      reason: reason || undefined,
    });
    
    // Reset form
    setRating('accurate');
    setHumanOverrode(false);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>How was this AI suggestion?</DialogTitle>
          <DialogDescription>
            Your feedback helps the AI improve over time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Show what was suggested */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">AI Suggested:</p>
            <p className="text-sm">{suggestedResponse}</p>
          </div>

          {/* Rating Selection */}
          <div className="space-y-3">
            <Label>Rate the suggestion</Label>
            <RadioGroup 
              value={rating} 
              onValueChange={(v) => setRating(v as SuggestionFeedback['rating'])}
              className="space-y-2"
            >
              {ratingOptions.map((option) => (
                <div 
                  key={option.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setRating(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <option.icon className={`h-5 w-5 ${option.color}`} />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Override Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="override">Did you override the suggestion?</Label>
              <p className="text-xs text-muted-foreground">
                You said something different than what AI suggested
              </p>
            </div>
            <Switch 
              id="override" 
              checked={humanOverrode} 
              onCheckedChange={setHumanOverrode}
            />
          </div>

          {/* Optional Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Additional feedback (optional)</Label>
            <Textarea
              id="reason"
              placeholder="What could have made this suggestion better?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleSubmit}>
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
