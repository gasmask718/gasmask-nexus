import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentBadgeProps {
  sentiment: "positive" | "neutral" | "negative";
  score?: number;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function SentimentBadge({ sentiment, score, showScore = true, size = "md" }: SentimentBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-0.5",
    md: "text-sm px-2 py-1 gap-1",
    lg: "text-base px-3 py-1.5 gap-1.5",
  };

  const iconSize = {
    sm: 10,
    md: 14,
    lg: 18,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeClasses[size],
        sentiment === "positive" && "bg-green-500/20 text-green-400",
        sentiment === "negative" && "bg-red-500/20 text-red-400",
        sentiment === "neutral" && "bg-muted text-muted-foreground"
      )}
    >
      {sentiment === "positive" && <TrendingUp size={iconSize[size]} />}
      {sentiment === "negative" && <TrendingDown size={iconSize[size]} />}
      {sentiment === "neutral" && <Minus size={iconSize[size]} />}
      <span className="capitalize">{sentiment}</span>
      {showScore && score !== undefined && (
        <span className="opacity-70">
          {score > 0 ? "+" : ""}{score}
        </span>
      )}
    </span>
  );
}
