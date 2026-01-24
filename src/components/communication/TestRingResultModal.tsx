import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Phone, 
  Building2, 
  User,
  Users,
  ArrowRight,
  Lightbulb,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TestRingStep {
  step: string;
  status: "success" | "failure" | "skipped";
  details: string;
  data?: Record<string, any>;
}

export interface TestRingResult {
  success: boolean;
  steps: TestRingStep[];
  summary: {
    businessName?: string;
    inboundNumber?: string;
    routeType?: string;
    routeTarget?: string;
    callableUsersCount?: number;
    totalUsersCount?: number;
    targetUserName?: string;
    targetPhone?: string;
    twilioCallSid?: string;
    failurePoint?: string;
    failureReason?: string;
    suggestedFix?: string;
  };
  callLogId?: string;
}

interface TestRingResultModalProps {
  result: TestRingResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TestRingResultModal({ result, isOpen, onClose }: TestRingResultModalProps) {
  if (!result) return null;

  const { success, steps, summary } = result;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {success ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-green-700">Test Ring Successful</span>
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                <span className="text-destructive">Test Ring Failed</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {success 
              ? "The test call was initiated successfully. The target phone should be ringing."
              : "The test ring could not complete. See details below."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Card */}
          <div className={cn(
            "rounded-lg border p-4 space-y-3",
            success ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          )}>
            {summary.businessName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Business:</span>
                <span className="font-medium">{summary.businessName}</span>
              </div>
            )}
            {summary.inboundNumber && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Inbound Number:</span>
                <span className="font-mono">{summary.inboundNumber}</span>
              </div>
            )}
            {summary.routeType && (
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Route:</span>
                <Badge variant="outline" className="capitalize">{summary.routeType}</Badge>
                {summary.routeTarget && (
                  <span className="text-muted-foreground">→ {summary.routeTarget}</span>
                )}
              </div>
            )}
            {(summary.callableUsersCount !== undefined || summary.totalUsersCount !== undefined) && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Callable Users:</span>
                <Badge 
                  variant={summary.callableUsersCount && summary.callableUsersCount > 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {summary.callableUsersCount}/{summary.totalUsersCount}
                </Badge>
              </div>
            )}
            {summary.targetUserName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Target:</span>
                <span className="font-medium">{summary.targetUserName}</span>
              </div>
            )}
            {summary.targetPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Dialed:</span>
                <span className="font-mono">{summary.targetPhone}</span>
              </div>
            )}
            {summary.twilioCallSid && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Call SID:</span>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{summary.twilioCallSid}</code>
              </div>
            )}
          </div>

          {/* Failure Details */}
          {!success && summary.failurePoint && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failure Point: {summary.failurePoint}</AlertTitle>
              <AlertDescription className="mt-2">
                {summary.failureReason}
              </AlertDescription>
            </Alert>
          )}

          {/* Suggested Fix */}
          {!success && summary.suggestedFix && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Suggested Fix</AlertTitle>
              <AlertDescription>
                {summary.suggestedFix}
              </AlertDescription>
            </Alert>
          )}

          {/* Steps Timeline */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Execution Steps</h4>
            <div className="space-y-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 text-sm p-2 rounded",
                    step.status === "success" && "bg-green-50 dark:bg-green-950/20",
                    step.status === "failure" && "bg-red-50 dark:bg-red-950/20",
                    step.status === "skipped" && "bg-muted/50"
                  )}
                >
                  {step.status === "success" && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  )}
                  {step.status === "failure" && (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  {step.status === "skipped" && (
                    <SkipForward className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{step.step}</span>
                    <p className="text-muted-foreground text-xs mt-0.5 break-words">
                      {step.details}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
