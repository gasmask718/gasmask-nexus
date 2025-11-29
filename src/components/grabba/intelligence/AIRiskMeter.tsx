import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useGrabbaIntelligence } from "@/hooks/useGrabbaIntelligence";

export function AIRiskMeter() {
  const { data, isLoading } = useGrabbaIntelligence();
  const health = data?.metrics?.overallHealth || 0;

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-500', bgColor: 'bg-green-500', icon: CheckCircle };
    if (score >= 60) return { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-500', icon: Shield };
    if (score >= 40) return { label: 'Warning', color: 'text-amber-500', bgColor: 'bg-amber-500', icon: AlertTriangle };
    return { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500', icon: AlertTriangle };
  };

  const status = getHealthStatus(health);
  const StatusIcon = status.icon;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-40 bg-muted/30 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-emerald-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          System Health
        </CardTitle>
        <CardDescription>AI-powered risk assessment</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main Health Score */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-32 h-32">
            {/* Background circle */}
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${(health / 100) * 352} 352`}
                strokeLinecap="round"
                className={status.color}
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${status.color}`}>{health}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${status.color}`} />
            <Badge className={`${status.bgColor} text-white`}>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
            <span className="text-sm text-muted-foreground">Critical Alerts</span>
            <Badge variant={data?.metrics?.criticalAlerts ? "destructive" : "outline"}>
              {data?.metrics?.criticalAlerts || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
            <span className="text-sm text-muted-foreground">Warnings</span>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              {data?.metrics?.warningAlerts || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
            <span className="text-sm text-muted-foreground">Low Stock Stores</span>
            <Badge variant="outline">
              {data?.metrics?.lowStockCount || 0}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-background/50">
            <span className="text-sm text-muted-foreground">Unpaid Balance</span>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
              ${(data?.metrics?.unpaidTotal || 0).toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
