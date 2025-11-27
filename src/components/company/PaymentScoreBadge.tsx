import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PaymentScoreBadgeProps {
  score: number;
  tier: string;
  compact?: boolean;
}

const tierConfig: Record<string, { color: string; bg: string; stars: number }> = {
  elite: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", stars: 5 },
  solid: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", stars: 4 },
  middle: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30", stars: 3 },
  concerning: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", stars: 2 },
  danger: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", stars: 1 },
};

export function PaymentScoreBadge({ score, tier, compact = false }: PaymentScoreBadgeProps) {
  const config = tierConfig[tier] || tierConfig.middle;

  if (compact) {
    return (
      <Badge variant="outline" className={`${config.bg} ${config.color} gap-1`}>
        <Star className="h-3 w-3 fill-current" />
        {tier.toUpperCase()} ({score})
      </Badge>
    );
  }

  return (
    <Card className={`${config.bg} border overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Payment Reliability</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < config.stars ? `${config.color} fill-current` : "text-muted"}`}
                />
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${config.color}`}>{score}</p>
            <Badge variant="outline" className={`${config.color} text-xs`}>
              {tier.toUpperCase()}
            </Badge>
          </div>
        </div>
        <Progress value={score} className="h-1.5" />
      </CardContent>
    </Card>
  );
}
