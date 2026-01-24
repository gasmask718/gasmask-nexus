import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, ShieldCheck, Loader2, Zap } from "lucide-react";
import { useActivateKillSwitch, useDeactivateKillSwitch } from "@/hooks/useCanaryMode";
import { cn } from "@/lib/utils";

interface CanaryKillSwitchProps {
  businessId: string;
  isActive: boolean;
  activeCallsCount: number;
}

export function CanaryKillSwitch({ 
  businessId, 
  isActive, 
  activeCallsCount 
}: CanaryKillSwitchProps) {
  const [showDialog, setShowDialog] = useState(false);
  const activateKillSwitch = useActivateKillSwitch();
  const deactivateKillSwitch = useDeactivateKillSwitch();

  const handleActivate = async () => {
    await activateKillSwitch.mutateAsync(businessId);
    setShowDialog(false);
  };

  const handleDeactivate = async () => {
    await deactivateKillSwitch.mutateAsync(businessId);
  };

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isActive ? "border-destructive bg-destructive/5" : "border-muted"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            )}
            Kill Switch
          </div>
          <Badge variant={isActive ? "destructive" : "secondary"}>
            {isActive ? "ACTIVE" : "Standby"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isActive 
            ? "All AI calls are being transferred to humans. No new AI answering allowed."
            : "Emergency control to instantly stop all AI call answering and transfer to humans."
          }
        </p>

        {activeCallsCount > 0 && !isActive && (
          <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
            <Zap className="h-4 w-4" />
            <span>{activeCallsCount} active AI call{activeCallsCount !== 1 ? 's' : ''} will be transferred</span>
          </div>
        )}

        {isActive ? (
          <Button
            onClick={handleDeactivate}
            disabled={deactivateKillSwitch.isPending}
            variant="outline"
            className="w-full"
          >
            {deactivateKillSwitch.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Deactivate Kill Switch
          </Button>
        ) : (
          <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={activateKillSwitch.isPending}
              >
                {activateKillSwitch.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4 mr-2" />
                )}
                Activate Kill Switch
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  Activate Kill Switch?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Stop AI from answering any new calls</li>
                    <li>Transfer all {activeCallsCount} active AI calls to humans</li>
                    <li>Require manual reactivation to resume</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleActivate}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Activate Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
