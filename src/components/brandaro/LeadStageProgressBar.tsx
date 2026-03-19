import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PIPELINE_STAGES } from "@/hooks/useBrandaroPipeline";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const STAGE_ACTIVE_COLORS: Record<string, string> = {
  new: "bg-gray-500",
  contacted: "bg-amber-500",
  responded: "bg-blue-500",
  interested: "bg-purple-500",
  booked: "bg-teal-500",
  closed: "bg-green-600",
  lost: "bg-red-500",
};

const STAGE_PAST_COLORS: Record<string, string> = {
  new: "bg-gray-300",
  contacted: "bg-amber-300",
  responded: "bg-blue-300",
  interested: "bg-purple-300",
  booked: "bg-teal-300",
  closed: "bg-green-300",
  lost: "bg-red-300",
};

const STAGE_EVENT_MAP: Record<string, string> = {
  contacted: "call_made",
  responded: "sms_reply",
  interested: "interest_detected",
  booked: "appointment_booked",
  closed: "revenue_recorded",
  lost: "negative_response",
};

export function LeadStageProgressBar({
  currentStage,
  businessName,
  updatedAt,
  onStageChange,
}: {
  currentStage: string;
  businessName: string;
  updatedAt: string | null;
  onStageChange: (stage: string, eventType: string) => void;
}) {
  const [confirmStage, setConfirmStage] = useState<string | null>(null);
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isCurrent = stage.key === currentStage;
          const isPast = idx < currentIdx && currentStage !== "lost";
          const isFuture = !isCurrent && !isPast;

          return (
            <Popover
              key={stage.key}
              open={confirmStage === stage.key}
              onOpenChange={(o) => !o && setConfirmStage(null)}
            >
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex-1 h-7 rounded-full text-[10px] font-medium transition-all",
                    isCurrent && `${STAGE_ACTIVE_COLORS[stage.key]} text-white`,
                    isPast && `${STAGE_PAST_COLORS[stage.key]} text-white/80`,
                    isFuture && "bg-muted text-muted-foreground",
                    "hover:opacity-80"
                  )}
                  onClick={() => !isCurrent && setConfirmStage(stage.key)}
                >
                  {stage.label}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-2">
                <p className="text-xs">
                  Move <span className="font-semibold">{businessName}</span> to{" "}
                  <span className="font-semibold">{stage.label}</span>?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => {
                      onStageChange(stage.key, STAGE_EVENT_MAP[stage.key] || "stage_change");
                      setConfirmStage(null);
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setConfirmStage(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      {updatedAt && (
        <p className="text-[11px] text-muted-foreground">
          Stage updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
