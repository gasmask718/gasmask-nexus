import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";

interface PriorityBadgeProps {
  level: "high" | "medium" | "low";
  score?: number;
  showScore?: boolean;
}

export default function PriorityBadge({ level, score, showScore = false }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
        level === "high" && "bg-red-500/20 text-red-400",
        level === "medium" && "bg-yellow-500/20 text-yellow-400",
        level === "low" && "bg-green-500/20 text-green-400"
      )}
    >
      {level === "high" && <AlertCircle size={12} />}
      {level === "medium" && <AlertTriangle size={12} />}
      {level === "low" && <CheckCircle size={12} />}
      <span className="capitalize">{level}</span>
      {showScore && score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  );
}
