// Floor 9 - Feedback Analytics Panel
// Phase 9.2.1 - Learning Feedback Visualization

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Target,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import { useFeedbackAnalytics, FeedbackAnalytics } from '@/hooks/useLearningFeedback';

interface FeedbackAnalyticsPanelProps {
  days?: number;
}

export function FeedbackAnalyticsPanel({ days = 30 }: FeedbackAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useFeedbackAnalytics(days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Learning Feedback Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.totalFeedback === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Learning Feedback Analytics
          </CardTitle>
          <CardDescription>Last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No feedback data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Feedback will appear here as you approve, reject, or modify AI recommendations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Learning Feedback Analytics
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Last {days} days — {analytics.totalFeedback} feedback entries</span>
          <TrendBadge trend={analytics.feedbackTrend} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Approval Rate"
            value={`${analytics.approvalRate}%`}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            color="text-green-600"
          />
          <MetricCard
            label="Rejection Rate"
            value={`${analytics.rejectionRate}%`}
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            color="text-red-600"
          />
          <MetricCard
            label="Modification Rate"
            value={`${analytics.modificationRate}%`}
            icon={<Target className="h-4 w-4 text-yellow-500" />}
            color="text-yellow-600"
          />
          <MetricCard
            label="Overconfidence"
            value={`${analytics.overconfidenceRate}%`}
            icon={<Brain className="h-4 w-4 text-orange-500" />}
            color="text-orange-600"
          />
        </div>

        {/* Confidence Calibration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence Calibration Score</span>
            <span className="text-sm font-bold">{analytics.confidenceCalibrationScore}%</span>
          </div>
          <Progress 
            value={analytics.confidenceCalibrationScore} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {analytics.confidenceCalibrationScore >= 70 
              ? 'AI confidence predictions are well-calibrated'
              : analytics.confidenceCalibrationScore >= 50
              ? 'AI confidence predictions need improvement'
              : 'AI confidence predictions are poorly calibrated — recalibration recommended'}
          </p>
        </div>

        {/* Confidence Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Avg Confidence (Approved)</p>
            <p className="text-xl font-bold text-green-600">{analytics.avgConfidenceApproved}%</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Avg Confidence (Rejected)</p>
            <p className="text-xl font-bold text-red-600">{analytics.avgConfidenceRejected}%</p>
          </div>
        </div>

        {/* Confidence Gap Alert */}
        {analytics.avgConfidenceApproved > 0 && analytics.avgConfidenceRejected > 0 && (
          <ConfidenceGapAlert
            approvedAvg={analytics.avgConfidenceApproved}
            rejectedAvg={analytics.avgConfidenceRejected}
          />
        )}

        {/* Top Rejection Reasons */}
        {analytics.topRejectionReasons.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Top Rejection Reasons
            </h4>
            <div className="space-y-2">
              {analytics.topRejectionReasons.map((reason, idx) => (
                <div key={reason.category} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{reason.category.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{reason.count} ({reason.percentage}%)</span>
                    </div>
                    <Progress value={reason.percentage} className="h-1 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Insight */}
        <LearningInsight analytics={analytics} />
      </CardContent>
    </Card>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode; 
  color: string;
}) {
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  if (trend === 'improving') {
    return (
      <Badge variant="default" className="bg-green-500">
        <TrendingUp className="h-3 w-3 mr-1" />
        Improving
      </Badge>
    );
  }
  if (trend === 'declining') {
    return (
      <Badge variant="destructive">
        <TrendingDown className="h-3 w-3 mr-1" />
        Declining
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Minus className="h-3 w-3 mr-1" />
      Stable
    </Badge>
  );
}

function ConfidenceGapAlert({ approvedAvg, rejectedAvg }: { approvedAvg: number; rejectedAvg: number }) {
  const gap = approvedAvg - rejectedAvg;
  
  // Good: approved confidence >> rejected confidence
  if (gap >= 20) {
    return (
      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
        <p className="font-medium text-green-600 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Good Calibration
        </p>
        <p className="text-muted-foreground mt-1">
          AI shows {gap}% higher confidence on approved items — this indicates healthy calibration.
        </p>
      </div>
    );
  }
  
  // Warning: gap is too small
  if (gap >= 0 && gap < 20) {
    return (
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
        <p className="font-medium text-yellow-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Calibration Warning
        </p>
        <p className="text-muted-foreground mt-1">
          Confidence gap is only {gap}% — AI may need recalibration to better distinguish good from bad recommendations.
        </p>
      </div>
    );
  }
  
  // Critical: rejected has higher confidence than approved (inverted!)
  return (
    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
      <p className="font-medium text-red-600 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Inverted Confidence
      </p>
      <p className="text-muted-foreground mt-1">
        AI shows {Math.abs(gap)}% <strong>higher</strong> confidence on rejected items — confidence recalibration is critical.
      </p>
    </div>
  );
}

function LearningInsight({ analytics }: { analytics: FeedbackAnalytics }) {
  // Generate actionable insight based on data
  let insight = '';
  let severity: 'info' | 'warning' | 'critical' = 'info';

  if (analytics.overconfidenceRate > 30) {
    insight = `${analytics.overconfidenceRate}% of decisions flagged AI as overconfident. Consider lowering confidence thresholds for approval gates.`;
    severity = 'warning';
  } else if (analytics.rejectionRate > 50) {
    insight = `High rejection rate (${analytics.rejectionRate}%). Review playbook rules — they may be too aggressive or instructions unclear.`;
    severity = 'warning';
  } else if (analytics.modificationRate > 40) {
    insight = `${analytics.modificationRate}% of approvals required modification. AI outputs are close but need refinement.`;
    severity = 'info';
  } else if (analytics.approvalRate > 80) {
    insight = `Excellent ${analytics.approvalRate}% approval rate. Consider gradually increasing AI autonomy on high-confidence tasks.`;
    severity = 'info';
  } else {
    insight = 'Continue collecting feedback to generate deeper insights about AI performance patterns.';
    severity = 'info';
  }

  const colorMap = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
    critical: 'bg-red-500/10 border-red-500/30 text-red-600',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorMap[severity]}`}>
      <p className="font-medium flex items-center gap-2 text-sm">
        <Lightbulb className="h-4 w-4" />
        Learning Insight
      </p>
      <p className="text-sm mt-1 text-muted-foreground">{insight}</p>
    </div>
  );
}
