import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Users,
  Bot,
} from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { usePlaybooks, useSpeakerStyles, useTechniqueExtractions } from '@/hooks/usePlaybooks';

export function PlaybookAnalytics() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? null;

  const { data: playbooks, isLoading: loadingPlaybooks } = usePlaybooks(businessId);
  const { data: styles, isLoading: loadingStyles } = useSpeakerStyles(businessId);
  const { data: techniques, isLoading: loadingTechniques } = useTechniqueExtractions(businessId);

  if (!businessId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a business to view analytics
      </div>
    );
  }

  const isLoading = loadingPlaybooks || loadingStyles || loadingTechniques;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate metrics
  const activePlaybooks = playbooks?.filter((p) => p.is_active).length ?? 0;
  const totalPlaybookUses = playbooks?.reduce((sum, p) => sum + p.times_used, 0) ?? 0;
  const avgOutcomeScore =
    playbooks && playbooks.length > 0
      ? playbooks.reduce((sum, p) => sum + (p.avg_outcome_score ?? 0), 0) / playbooks.length
      : 0;
  const avgConversionRate =
    playbooks && playbooks.length > 0
      ? playbooks.reduce((sum, p) => sum + (p.conversion_rate ?? 0), 0) / playbooks.length
      : 0;

  const activeStyles = styles?.filter((s) => s.is_active).length ?? 0;
  const totalStyleUses = styles?.reduce((sum, s) => sum + s.times_used, 0) ?? 0;
  const avgSatisfaction =
    styles && styles.length > 0
      ? styles.reduce((sum, s) => sum + (s.avg_caller_satisfaction ?? 0), 0) / styles.length
      : 0;

  const pendingTechniques = techniques?.filter((t) => !t.human_validated).length ?? 0;
  const approvedTechniques = techniques?.filter((t) => t.is_approved_for_ai).length ?? 0;
  const totalTechniques = techniques?.length ?? 0;

  // Top performers
  const topPlaybook = playbooks?.reduce(
    (best, p) => ((p.avg_outcome_score ?? 0) > (best?.avg_outcome_score ?? 0) ? p : best),
    playbooks[0]
  );
  const topStyle = styles?.reduce(
    (best, s) => ((s.avg_caller_satisfaction ?? 0) > (best?.avg_caller_satisfaction ?? 0) ? s : best),
    styles[0]
  );

  const getTrendIcon = (value: number, threshold: number) => {
    if (value >= threshold * 1.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value <= threshold * 0.9) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Read-only metrics — no live overrides
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Playbooks</p>
                <p className="text-2xl font-bold">{activePlaybooks}</p>
              </div>
              <Target className="h-8 w-8 text-primary/20" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {totalPlaybookUses} total uses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Outcome Score</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{avgOutcomeScore.toFixed(0)}</p>
                  {getTrendIcon(avgOutcomeScore, 70)}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={avgOutcomeScore} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">
                  {(avgConversionRate * 100).toFixed(1)}%
                </p>
              </div>
              <Users className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={avgConversionRate * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Caller Satisfaction</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{avgSatisfaction.toFixed(0)}%</p>
                  {getTrendIcon(avgSatisfaction, 75)}
                </div>
              </div>
              <Bot className="h-8 w-8 text-primary/20" />
            </div>
            <Progress value={avgSatisfaction} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Playbook</CardTitle>
          </CardHeader>
          <CardContent>
            {topPlaybook ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{topPlaybook.name}</h3>
                  <Badge className="bg-green-500/10 text-green-600">
                    {topPlaybook.avg_outcome_score?.toFixed(0) ?? '—'} score
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Uses:</span>{' '}
                    {topPlaybook.times_used}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Conversion:</span>{' '}
                    {topPlaybook.conversion_rate
                      ? `${(topPlaybook.conversion_rate * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {topPlaybook.target_intents.slice(0, 3).map((intent) => (
                    <Badge key={intent} variant="outline" className="text-xs">
                      {intent}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No playbook data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Style</CardTitle>
          </CardHeader>
          <CardContent>
            {topStyle ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{topStyle.name}</h3>
                  <Badge className="bg-green-500/10 text-green-600">
                    {topStyle.avg_caller_satisfaction?.toFixed(0) ?? '—'}% satisfaction
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tone:</span>{' '}
                    <span className="capitalize">{topStyle.tone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uses:</span>{' '}
                    {topStyle.times_used}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topStyle.uses_humor && (
                    <Badge variant="secondary" className="text-xs">Humor</Badge>
                  )}
                  {topStyle.uses_stories && (
                    <Badge variant="secondary" className="text-xs">Stories</Badge>
                  )}
                  {topStyle.uses_questions && (
                    <Badge variant="secondary" className="text-xs">Questions</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No style data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Technique Adoption */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technique Adoption Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalTechniques}</div>
              <div className="text-sm text-muted-foreground">Total Extracted</div>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{pendingTechniques}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </div>
            <div className="h-px w-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{approvedTechniques}</div>
              <div className="text-sm text-muted-foreground">Approved for AI</div>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Approval Rate</div>
              <div className="text-2xl font-bold">
                {totalTechniques > 0
                  ? `${((approvedTechniques / totalTechniques) * 100).toFixed(0)}%`
                  : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Playbook Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Playbook Performance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {playbooks && playbooks.length > 0 ? (
            <div className="space-y-3">
              {playbooks
                .sort((a, b) => (b.avg_outcome_score ?? 0) - (a.avg_outcome_score ?? 0))
                .slice(0, 5)
                .map((playbook, i) => (
                  <div key={playbook.id} className="flex items-center gap-4">
                    <div className="w-6 text-center font-bold text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{playbook.name}</span>
                        <span className="text-sm">
                          {playbook.avg_outcome_score?.toFixed(0) ?? '—'}
                        </span>
                      </div>
                      <Progress
                        value={playbook.avg_outcome_score ?? 0}
                        className="h-2 mt-1"
                      />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No playbook performance data yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
