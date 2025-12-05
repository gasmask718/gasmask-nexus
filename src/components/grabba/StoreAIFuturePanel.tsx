// ═══════════════════════════════════════════════════════════════════════════════
// STORE AI FUTURE PANEL — Customer Memory Core V3 Predictive Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus, 
  AlertTriangle, Sparkles, Calendar, DollarSign, Heart,
  Shield, Users, Target
} from 'lucide-react';
import { useStoreAIInsights, useRefreshStoreAIInsights } from '@/hooks/useStoreAIInsights';
import { format } from 'date-fns';

interface StoreAIFuturePanelProps {
  storeId: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No prediction';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

function getTrendIcon(trend: string | null) {
  switch (trend) {
    case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getMoodColor(mood: string | null): string {
  switch (mood) {
    case 'high_buying_mood': return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'neutral': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'frustrated': return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    case 'at_risk': return 'bg-red-500/20 text-red-400 border-red-500/40';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getPhaseColor(phase: string | null): string {
  switch (phase) {
    case 'new': return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    case 'growth': return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'loyal': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'decline': return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'recovery': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getRiskLabel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Unknown', color: 'text-muted-foreground' };
  if (score <= 30) return { label: 'Low', color: 'text-green-500' };
  if (score <= 60) return { label: 'Medium', color: 'text-amber-500' };
  return { label: 'High', color: 'text-red-500' };
}

function ScoreBar({ label, score, icon: Icon, color }: { label: string; score: number | null; icon: any; color: string }) {
  const value = score ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          {label}
        </span>
        <span className="font-medium">{score !== null ? score : '—'}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${color.replace('text-', 'bg-')}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function StoreAIFuturePanel({ storeId }: StoreAIFuturePanelProps) {
  const { data: insights, isLoading } = useStoreAIInsights(storeId);
  const refreshMutation = useRefreshStoreAIInsights(storeId);

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Customer Memory Core V3 — Future View
          </CardTitle>
          <CardDescription>
            AI-powered predictive intelligence for this store
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">
            No AI insights yet. Click below to generate the first prediction for this store.
          </p>
          <Button 
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const riskInfo = getRiskLabel(insights.risk_score);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Customer Memory Core V3 — Future View
            </CardTitle>
            <CardDescription className="mt-1">
              Last updated: {formatDate(insights.snapshot_date)}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Row: Future Snapshot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Next Predicted Order */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Calendar className="h-4 w-4 text-blue-500" />
              Next Predicted Order
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatDate(insights.next_order_date)}
            </div>
            {insights.next_order_confidence !== null && (
              <div className="text-xs text-muted-foreground mb-2">
                Confidence: {Math.round(insights.next_order_confidence * 100)}%
              </div>
            )}
            {insights.next_order_summary && (
              <p className="text-sm text-muted-foreground">
                {insights.next_order_summary}
              </p>
            )}
          </div>

          {/* Relationship Health */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Heart className="h-4 w-4 text-pink-500" />
              Relationship Health
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {insights.mood_state && (
                <Badge className={getMoodColor(insights.mood_state)}>
                  {insights.mood_state.replace(/_/g, ' ')}
                </Badge>
              )}
              {insights.relationship_phase && (
                <Badge className={getPhaseColor(insights.relationship_phase)}>
                  {insights.relationship_phase}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Trend:</span>
              {getTrendIcon(insights.relationship_trend)}
              <span className="capitalize">{insights.relationship_trend || 'unknown'}</span>
            </div>
          </div>
        </div>

        {/* Scores Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk & Loyalty
            </h4>
            <div className="p-3 rounded-lg border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Level</span>
                <span className={`font-medium ${riskInfo.color}`}>
                  {insights.risk_score ?? '—'} ({riskInfo.label})
                </span>
              </div>
              <ScoreBar label="Loyalty" score={insights.loyalty_score} icon={Heart} color="text-pink-500" />
              <ScoreBar label="Health" score={insights.health_score} icon={TrendingUp} color="text-green-500" />
              <ScoreBar label="Influence" score={insights.influence_score} icon={Users} color="text-blue-500" />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              12-Month LTV Forecast
            </h4>
            <div className="p-3 rounded-lg border bg-card">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Low</div>
                  <div className="font-semibold text-red-400">
                    ${insights.ltv_12m_low?.toLocaleString() ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Expected</div>
                  <div className="font-bold text-lg text-green-400">
                    ${insights.ltv_12m_expected?.toLocaleString() ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">High</div>
                  <div className="font-semibold text-blue-400">
                    ${insights.ltv_12m_high?.toLocaleString() ?? '—'}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t space-y-1">
                {insights.buying_style && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Buying Style</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {insights.buying_style.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                )}
                {insights.personality_archetype && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Archetype</span>
                    <span className="font-medium">{insights.personality_archetype}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Next Best Action */}
        {insights.next_best_action && (
          <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Target className="h-4 w-4 text-primary" />
              Next Best Action
            </div>
            <p className="text-sm">{insights.next_best_action}</p>
          </div>
        )}

        {/* Warnings & Opportunities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.early_warning_flags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Early Warning Flags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {insights.early_warning_flags.map((flag, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                    {flag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {insights.opportunity_flags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-green-400">
                <Sparkles className="h-4 w-4" />
                Growth Opportunities
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {insights.opportunity_flags.map((opp, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-green-500/40 text-green-400">
                    {opp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Relationship Timeline */}
        {insights.timeline_chapters.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Relationship Timeline</h4>
            <div className="space-y-2">
              {insights.timeline_chapters.map((chapter, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1 bg-primary/40 rounded-full self-stretch min-h-[40px]" />
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getPhaseColor(chapter.phase.toLowerCase())} variant="outline">
                        {chapter.phase}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {chapter.from && formatDate(chapter.from)}
                        {chapter.to && ` — ${formatDate(chapter.to)}`}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{chapter.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
