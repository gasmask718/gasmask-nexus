import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown,
  Brain,
  Eye,
  Zap,
  Crown
} from "lucide-react";
import { AITrustScore, AICallAgentConfig } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";

interface AITrustMeterProps {
  trustScore: AITrustScore | null;
  config: AICallAgentConfig | null;
  isLoading?: boolean;
}

const MODE_CONFIG = {
  off: { label: 'Off', icon: Shield, color: 'bg-muted text-muted-foreground', description: 'AI agent disabled' },
  shadow: { label: 'Shadow', icon: Eye, color: 'bg-secondary text-secondary-foreground', description: 'Observing & learning' },
  assisted: { label: 'Assisted', icon: Brain, color: 'bg-blue-500/20 text-blue-600', description: 'Suggesting responses' },
  canary: { label: 'Canary', icon: Zap, color: 'bg-amber-500/20 text-amber-600', description: 'Limited live answering' },
  live: { label: 'Live', icon: Crown, color: 'bg-green-500/20 text-green-600', description: 'Full AI answering' },
};

export function AITrustMeter({ trustScore, config, isLoading }: AITrustMeterProps) {
  const mode = config?.mode || 'off';
  const modeInfo = MODE_CONFIG[mode];
  const ModeIcon = modeInfo.icon;

  const score = trustScore?.trust_score || 0;
  const accuracy = trustScore?.accuracy_rate || 0;
  const totalPredictions = trustScore?.total_predictions || 0;

  const getScoreColor = (value: number) => {
    if (value >= 85) return 'text-green-500';
    if (value >= 70) return 'text-amber-500';
    if (value >= 50) return 'text-orange-500';
    return 'text-destructive';
  };

  const getProgressColor = (value: number) => {
    if (value >= 85) return 'bg-green-500';
    if (value >= 70) return 'bg-amber-500';
    if (value >= 50) return 'bg-orange-500';
    return 'bg-destructive';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            AI Trust Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            AI Trust Score
          </CardTitle>
          <Badge className={cn("gap-1", modeInfo.color)}>
            <ModeIcon className="h-3 w-3" />
            {modeInfo.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{modeInfo.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Trust Score */}
        <div className="text-center">
          <div className={cn("text-5xl font-bold", getScoreColor(score))}>
            {score}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Trust Score</p>
          <Progress 
            value={score} 
            className="mt-3 h-2" 
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={cn("text-2xl font-semibold", getScoreColor(accuracy))}>
              {accuracy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Accuracy Rate</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-semibold">
              {totalPredictions}
            </div>
            <p className="text-xs text-muted-foreground">Predictions</p>
          </div>
        </div>

        {/* Streak Indicators */}
        {trustScore && (
          <div className="flex items-center justify-between text-sm">
            {trustScore.consecutive_successes > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>{trustScore.consecutive_successes} streak</span>
              </div>
            )}
            {trustScore.consecutive_failures > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span>{trustScore.consecutive_failures} failures</span>
              </div>
            )}
            <div className="text-muted-foreground">
              {trustScore.human_override_count} overrides
            </div>
          </div>
        )}

        {/* Mode Progression */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Mode Progression</p>
          <div className="flex items-center gap-1">
            {Object.entries(MODE_CONFIG).filter(([key]) => key !== 'off').map(([key, info], index) => {
              const Icon = info.icon;
              const isActive = key === mode;
              const isPast = ['shadow', 'assisted', 'canary', 'live'].indexOf(key) < 
                            ['shadow', 'assisted', 'canary', 'live'].indexOf(mode);
              
              return (
                <div key={key} className="flex items-center">
                  <div 
                    className={cn(
                      "p-1.5 rounded-full transition-colors",
                      isActive ? info.color : isPast ? "bg-primary/20" : "bg-muted"
                    )}
                  >
                    <Icon className={cn(
                      "h-3 w-3",
                      isActive || isPast ? "" : "text-muted-foreground"
                    )} />
                  </div>
                  {index < 3 && (
                    <div className={cn(
                      "w-6 h-0.5",
                      isPast ? "bg-primary/40" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Promotion Hints */}
        {mode === 'shadow' && totalPredictions < 25 && (
          <p className="text-xs text-muted-foreground text-center">
            {25 - totalPredictions} more predictions needed for Assisted mode
          </p>
        )}
        {mode === 'assisted' && totalPredictions < 50 && (
          <p className="text-xs text-muted-foreground text-center">
            {50 - totalPredictions} more predictions needed for Canary mode
          </p>
        )}
      </CardContent>
    </Card>
  );
}
