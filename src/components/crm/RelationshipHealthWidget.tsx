import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, AlertTriangle, TrendingUp, Crown, Users } from "lucide-react";
import { getRelationshipHealthOverview } from "@/services/crmInsightsService";
import { Progress } from "@/components/ui/progress";

export function RelationshipHealthWidget() {
  const { data: health, isLoading } = useQuery({
    queryKey: ["relationship-health-overview"],
    queryFn: getRelationshipHealthOverview,
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-32 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading health data...</div>
        </div>
      </Card>
    );
  }

  if (!health || health.total === 0) {
    return (
      <Card className="p-4">
        <CardHeader className="pb-2 px-0 pt-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Relationship Health
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <p className="text-sm text-muted-foreground">No store data available</p>
        </CardContent>
      </Card>
    );
  }

  const { fragile, neutral, strong, elite, total } = health;
  
  const tiers = [
    { 
      label: "Elite", 
      count: elite, 
      percent: Math.round((elite / total) * 100),
      color: "bg-purple-500", 
      textColor: "text-purple-400",
      icon: Crown 
    },
    { 
      label: "Strong", 
      count: strong, 
      percent: Math.round((strong / total) * 100),
      color: "bg-emerald-500", 
      textColor: "text-emerald-400",
      icon: TrendingUp 
    },
    { 
      label: "Neutral", 
      count: neutral, 
      percent: Math.round((neutral / total) * 100),
      color: "bg-slate-500", 
      textColor: "text-slate-400",
      icon: Users 
    },
    { 
      label: "Fragile", 
      count: fragile, 
      percent: Math.round((fragile / total) * 100),
      color: "bg-red-500", 
      textColor: "text-red-400",
      icon: AlertTriangle 
    },
  ];

  return (
    <Card className="p-4">
      <CardHeader className="pb-3 px-0 pt-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          Relationship Health Snapshot
        </CardTitle>
        <p className="text-xs text-muted-foreground">{total} stores tracked</p>
      </CardHeader>
      <CardContent className="px-0 pb-0 space-y-3">
        {tiers.map((tier) => (
          <div key={tier.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <tier.icon className={`h-3 w-3 ${tier.textColor}`} />
                <span className={tier.textColor}>{tier.label}</span>
              </div>
              <span className="font-medium">{tier.count} ({tier.percent}%)</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${tier.color} transition-all duration-500`}
                style={{ width: `${tier.percent}%` }}
              />
            </div>
          </div>
        ))}
        
        {/* Summary */}
        <div className="pt-2 border-t border-border mt-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Healthy (Strong + Elite)</span>
            <span className="font-semibold text-emerald-400">
              {strong + elite} ({Math.round(((strong + elite) / total) * 100)}%)
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-muted-foreground">Needs Attention (Fragile)</span>
            <span className="font-semibold text-red-400">
              {fragile} ({Math.round((fragile / total) * 100)}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
