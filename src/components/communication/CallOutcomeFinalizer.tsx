import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot,
  User,
  PhoneForwarded,
  PhoneOff,
  Voicemail,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

export type FinalCallOutcome =
  | "answered_by_ai"
  | "answered_by_human"
  | "escalated"
  | "aborted"
  | "voicemail"
  | "missed";

interface CallOutcomeFinalizerProps {
  currentOutcome?: FinalCallOutcome;
  onFinalize: (outcome: FinalCallOutcome, reason: string) => void;
  isProcessing?: boolean;
  abortReason?: string;
  escalationReason?: string;
  className?: string;
}

const outcomeConfig: Record<
  FinalCallOutcome,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    requiresReason: boolean;
  }
> = {
  answered_by_ai: {
    label: "Answered by AI",
    description: "Call was handled autonomously by AI",
    icon: Bot,
    bgClass: "bg-primary/10 border-primary/30",
    requiresReason: false,
  },
  answered_by_human: {
    label: "Answered by Human",
    description: "Call was handled by a human operator",
    icon: User,
    bgClass: "bg-green-500/10 border-green-500/30",
    requiresReason: false,
  },
  escalated: {
    label: "Escalated",
    description: "Call was transferred to human due to risk/request",
    icon: PhoneForwarded,
    bgClass: "bg-amber-500/10 border-amber-500/30",
    requiresReason: true,
  },
  aborted: {
    label: "Aborted",
    description: "AI stopped mid-call due to safety trigger",
    icon: XCircle,
    bgClass: "bg-destructive/10 border-destructive/30",
    requiresReason: true,
  },
  voicemail: {
    label: "Voicemail",
    description: "Caller left a voicemail message",
    icon: Voicemail,
    bgClass: "bg-blue-500/10 border-blue-500/30",
    requiresReason: false,
  },
  missed: {
    label: "Missed",
    description: "Call was not answered",
    icon: PhoneOff,
    bgClass: "bg-red-500/10 border-red-500/30",
    requiresReason: true,
  },
};

export function CallOutcomeFinalizer({
  currentOutcome,
  onFinalize,
  isProcessing,
  abortReason,
  escalationReason,
  className,
}: CallOutcomeFinalizerProps) {
  const [selectedOutcome, setSelectedOutcome] = React.useState<FinalCallOutcome | undefined>(
    currentOutcome
  );
  const [reason, setReason] = React.useState(abortReason || escalationReason || "");

  const config = selectedOutcome ? outcomeConfig[selectedOutcome] : null;

  const handleFinalize = () => {
    if (!selectedOutcome) return;
    onFinalize(selectedOutcome, reason);
  };

  // If already finalized, show the outcome
  if (currentOutcome) {
    const finalConfig = outcomeConfig[currentOutcome];
    const FinalIcon = finalConfig.icon;

    return (
      <Card className={`${finalConfig.bgClass} ${className}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FinalIcon className="h-5 w-5" />
            <CardTitle className="text-base">Final Outcome</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{finalConfig.label}</p>
              <p className="text-sm text-muted-foreground">{finalConfig.description}</p>
            </div>
            <Badge variant="outline">
              <CheckCircle className="h-3 w-3 mr-1" />
              Finalized
            </Badge>
          </div>
          {(abortReason || escalationReason) && (
            <div className="mt-3 p-2 bg-muted rounded text-sm">
              <strong>Reason:</strong> {abortReason || escalationReason}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-amber-500/50 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Call Outcome Required</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Every call must end in a final state. Select the outcome to close this call record.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Select
            value={selectedOutcome}
            onValueChange={(val) => setSelectedOutcome(val as FinalCallOutcome)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select call outcome..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(outcomeConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {config?.requiresReason && (
            <Textarea
              placeholder={`Why was this call ${selectedOutcome === "aborted" ? "aborted" : selectedOutcome === "escalated" ? "escalated" : "missed"}?`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          )}

          <Button
            onClick={handleFinalize}
            disabled={!selectedOutcome || (config?.requiresReason && !reason.trim()) || isProcessing}
            className="w-full"
          >
            {isProcessing ? "Finalizing..." : "Finalize Call Outcome"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          This action is permanent and will be logged to the audit trail.
          No orphaned or "unknown" call states are allowed.
        </p>
      </CardContent>
    </Card>
  );
}

export default CallOutcomeFinalizer;
