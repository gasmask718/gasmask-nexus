import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Info, Heart, ShieldCheck, Clock, MessageSquare, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import type { WholesalerHealthSnapshot } from '@/hooks/useWholesalerIntelligence';

interface WholesalerHealthScoreProps {
  profile: any;
  snapshots: WholesalerHealthSnapshot[];
}

export function WholesalerHealthScore({ profile, snapshots }: WholesalerHealthScoreProps) {
  const currentScore = profile?.relationship_health_score || 50;
  const latestSnapshot = snapshots[0];
  const previousSnapshot = snapshots[1];

  const getTrendIcon = () => {
    if (!previousSnapshot) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const diff = currentScore - previousSnapshot.health_score;
    if (diff > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (diff < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTierLabel = (score: number) => {
    if (score >= 80) return { label: 'Elite', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    if (score >= 60) return { label: 'Strong', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    if (score >= 40) return { label: 'Neutral', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return { label: 'Fragile', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  const tier = getTierLabel(currentScore);

  const scoreComponents = [
    { 
      label: 'Order Consistency', 
      score: latestSnapshot?.order_consistency_score || 50,
      icon: ShieldCheck,
      tooltip: 'Based on order frequency and reliability'
    },
    { 
      label: 'Payment Punctuality', 
      score: latestSnapshot?.payment_punctuality_score || 50,
      icon: Clock,
      tooltip: 'Based on on-time payment history'
    },
    { 
      label: 'Communication', 
      score: latestSnapshot?.communication_score || 50,
      icon: MessageSquare,
      tooltip: 'Based on response rates and engagement'
    },
    { 
      label: 'Dispute History', 
      score: latestSnapshot?.dispute_score || 50,
      icon: AlertTriangle,
      tooltip: 'Based on dispute frequency and resolution'
    },
    { 
      label: 'Contract Adherence', 
      score: latestSnapshot?.contract_adherence_score || 50,
      icon: FileText,
      tooltip: 'Based on contract compliance'
    },
    { 
      label: 'Price Sensitivity', 
      score: latestSnapshot?.price_sensitivity_score || 50,
      icon: DollarSign,
      tooltip: 'Based on pricing negotiations and acceptance'
    },
  ];

  const riskFactors = latestSnapshot?.risk_factors || profile?.risk_flags || [];

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Relationship Health Score
          </CardTitle>
          <Badge className={tier.color}>{tier.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Display */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className={`text-5xl font-bold ${getScoreColor(currentScore)}`}>
              {currentScore}
            </div>
            <div className="absolute -top-1 -right-6">
              {getTrendIcon()}
            </div>
          </div>
          <div className="flex-1">
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className={`absolute left-0 top-0 h-full rounded-full transition-all ${getProgressColor(currentScore)}`}
                style={{ width: `${currentScore}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {previousSnapshot && (
                <>
                  {currentScore > previousSnapshot.health_score ? '+' : ''}
                  {currentScore - previousSnapshot.health_score} pts from last snapshot
                </>
              )}
              {!previousSnapshot && 'No trend data yet'}
            </p>
          </div>
        </div>

        {/* Score Components */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <TooltipProvider>
            {scoreComponents.map((component) => (
              <Tooltip key={component.label}>
                <TooltipTrigger asChild>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 cursor-help">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <component.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{component.label}</span>
                      </div>
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-semibold ${getScoreColor(component.score)}`}>
                        {component.score}
                      </span>
                      <Progress 
                        value={component.score} 
                        className="h-1.5 flex-1"
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{component.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        {/* Risk Factors */}
        {riskFactors.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Risk Factors</p>
            <div className="flex flex-wrap gap-2">
              {riskFactors.map((factor: any, i: number) => (
                <Badge key={i} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {typeof factor === 'string' ? factor : factor.label || factor.type}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
