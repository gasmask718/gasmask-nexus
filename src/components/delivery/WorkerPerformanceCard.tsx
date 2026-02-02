// ═══════════════════════════════════════════════════════════════════════════════
// WORKER PERFORMANCE CARD — Floor 4 Phase 3
// Visual representation of worker performance profile
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Shield, 
  Star, 
  Target,
  AlertTriangle,
  Award,
  Zap
} from "lucide-react";
import type { WorkerPerformance } from "@/hooks/useRouteAnalytics";

interface WorkerPerformanceCardProps {
  performance: WorkerPerformance & { 
    worker?: { 
      id: string; 
      name: string; 
      role: string; 
      avatar_url?: string;
    } 
  };
  compact?: boolean;
}

export function WorkerPerformanceCard({ performance, compact = false }: WorkerPerformanceCardProps) {
  const getTrendIcon = () => {
    switch (performance.trend_direction) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getAutonomyBadge = () => {
    switch (performance.autonomy_level) {
      case 'auto_eligible':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <Zap className="h-3 w-3 mr-1" />
            Auto-Eligible
          </Badge>
        );
      case 'assisted':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Target className="h-3 w-3 mr-1" />
            Assisted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            Manual Only
          </Badge>
        );
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={performance.worker?.avatar_url} />
              <AvatarFallback>
                {performance.worker?.name?.charAt(0) || 'W'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {performance.worker?.name || 'Unknown'}
                </span>
                {getTrendIcon()}
              </div>
              <p className="text-xs text-muted-foreground">
                {performance.routes_completed_30d} routes (30d)
              </p>
            </div>
            
            <div className="text-right">
              <p className={`text-lg font-bold ${getScoreColor(performance.trust_score)}`}>
                {performance.trust_score}
              </p>
              <p className="text-xs text-muted-foreground">Trust</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={performance.worker?.avatar_url} />
              <AvatarFallback>
                {performance.worker?.name?.charAt(0) || 'W'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">
                {performance.worker?.name || 'Unknown Worker'}
              </CardTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {performance.worker?.role || 'Worker'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            {getAutonomyBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className={`text-2xl font-bold ${getScoreColor(performance.trust_score)}`}>
              {performance.trust_score}
            </p>
            <p className="text-xs text-muted-foreground">Trust Score</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className={`text-2xl font-bold ${getScoreColor(performance.reliability_score)}`}>
              {performance.reliability_score}
            </p>
            <p className="text-xs text-muted-foreground">Reliability</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className={`text-2xl font-bold ${getScoreColor(performance.consistency_score)}`}>
              {performance.consistency_score}
            </p>
            <p className="text-xs text-muted-foreground">Consistency</p>
          </div>
        </div>
        
        {/* Activity Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Routes (7d)</span>
            <span className="font-medium">{performance.routes_completed_7d}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Routes (30d)</span>
            <span className="font-medium">{performance.routes_completed_30d}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Avg Stop Time</span>
            <span className="font-medium">
              {performance.avg_stop_time_minutes?.toFixed(1) || 0} min
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium">
              {((performance.completion_rate || 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Completion Rate Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Delivery Success</span>
            <span>{((performance.completion_rate || 0) * 100).toFixed(0)}%</span>
          </div>
          <Progress value={(performance.completion_rate || 0) * 100} className="h-2" />
        </div>
        
        {/* Training Flag */}
        {performance.requires_training && (
          <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-orange-500">Training recommended</span>
          </div>
        )}
        
        {/* Auto-Eligible Badge */}
        {performance.autonomy_level === 'auto_eligible' && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Award className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500">
              Eligible for autonomous routing
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
