/**
 * SOFT ALERT ENGINE
 * 
 * Generates human-facing prompts that guide manager attention.
 * Alerts are:
 * - Advisory, not prescriptive
 * - Dismissible (session-only)
 * - Never auto-trigger actions
 * - Never label workers negatively
 */

import { useState, useMemo, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingDown,
  MessageSquareOff,
  Users,
  Gauge,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  X,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerSkillProfile } from '@/hooks/useWorkerPerformance';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ============================================
// TYPES
// ============================================

export type AlertSeverity = 'info' | 'attention' | 'risk';

export interface SoftAlert {
  id: string;
  severity: AlertSeverity;
  category: 'performance' | 'communication' | 'capacity' | 'positive';
  title: string;
  description: string;
  whyItMatters: string;
  managerPrompt?: string;
  workerIds?: string[];
}

export interface WorkerPrompt {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
}

interface SoftAlertEngineProps {
  profiles: WorkerSkillProfile[];
  presentWorkerIds: string[];
  communicationStats?: Map<string, {
    daysSinceContact: number | null;
    last7Days: number;
    hasDecliningTrend: boolean;
    isImproving: boolean;
  }>;
  targetCapacity?: number;
  currentCapacity?: number;
  maxAlerts?: number;
}

// ============================================
// ALERT GENERATION LOGIC (UI-ONLY)
// ============================================

function calculatePredictability(profile: WorkerSkillProfile): number {
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  
  return Math.round(
    (profile.reliability_score * 0.4) +
    ((1 - Math.min(consistencyVariance, 1)) * 100 * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );
}

export function generateSoftAlerts({
  profiles,
  presentWorkerIds,
  communicationStats,
  targetCapacity,
  currentCapacity,
}: SoftAlertEngineProps): SoftAlert[] {
  const alerts: SoftAlert[] = [];
  const presentProfiles = profiles.filter(p => presentWorkerIds.includes(p.worker_id));

  // ========================================
  // 1️⃣ PERFORMANCE ATTENTION ALERTS
  // ========================================
  
  // Workers with declining trends
  const decliningWorkers = presentProfiles.filter(
    p => p.trend_speed === 'declining' || p.trend_quality === 'declining'
  );
  
  if (decliningWorkers.length > 0) {
    alerts.push({
      id: 'performance-declining',
      severity: decliningWorkers.length >= 3 ? 'risk' : 'attention',
      category: 'performance',
      title: 'Performance Attention Needed',
      description: `${decliningWorkers.length} worker${decliningWorkers.length > 1 ? 's' : ''} show${decliningWorkers.length === 1 ? 's' : ''} declining trends compared to last week.`,
      whyItMatters: 'Rolling indicators suggest increased variability. Monitor output or consider check-in.',
      managerPrompt: decliningWorkers.length === 1 
        ? 'You may want to review this worker\'s recent output.'
        : 'Consider reviewing these workers\' recent performance.',
      workerIds: decliningWorkers.map(w => w.worker_id),
    });
  }

  // Workers with low predictability
  const lowPredictabilityWorkers = presentProfiles.filter(
    p => calculatePredictability(p) < 50
  );
  
  if (lowPredictabilityWorkers.length > 0 && lowPredictabilityWorkers.length >= presentProfiles.length * 0.4) {
    alerts.push({
      id: 'low-predictability',
      severity: 'attention',
      category: 'performance',
      title: 'Low Team Predictability',
      description: `${lowPredictabilityWorkers.length} worker${lowPredictabilityWorkers.length > 1 ? 's' : ''} ${lowPredictabilityWorkers.length === 1 ? 'has' : 'have'} predictability scores below 50.`,
      whyItMatters: 'Time-to-complete estimates may be less accurate. Plan for contingencies.',
      managerPrompt: 'Consider assigning high-reliability workers to critical tasks.',
      workerIds: lowPredictabilityWorkers.map(w => w.worker_id),
    });
  }

  // Workers with high defect rates
  const highDefectWorkers = presentProfiles.filter(
    p => (p.defect_rate_per_thousand || 0) > 15
  );
  
  if (highDefectWorkers.length > 0) {
    alerts.push({
      id: 'defect-spike',
      severity: highDefectWorkers.length >= 2 ? 'risk' : 'attention',
      category: 'performance',
      title: 'Quality Attention Needed',
      description: `${highDefectWorkers.length} worker${highDefectWorkers.length > 1 ? 's' : ''} ${highDefectWorkers.length === 1 ? 'has' : 'have'} defect rates above office average.`,
      whyItMatters: 'Elevated defects may impact batch quality. Additional QC checks may be warranted.',
      managerPrompt: 'Consider whether additional quality checks would be useful.',
      workerIds: highDefectWorkers.map(w => w.worker_id),
    });
  }

  // ========================================
  // 2️⃣ COMMUNICATION GAP ALERTS
  // ========================================
  
  if (communicationStats) {
    const noContactDeclining: string[] = [];
    const lowContactDeclining: string[] = [];

    communicationStats.forEach((stats, workerId) => {
      const profile = presentProfiles.find(p => p.worker_id === workerId);
      if (!profile) return;

      const hasDecliningTrend = profile.trend_speed === 'declining' || profile.trend_quality === 'declining';
      
      if (hasDecliningTrend && (stats.daysSinceContact === null || stats.daysSinceContact > 10)) {
        noContactDeclining.push(workerId);
      } else if (hasDecliningTrend && stats.last7Days < 2 && stats.daysSinceContact !== null && stats.daysSinceContact <= 10) {
        lowContactDeclining.push(workerId);
      }
    });

    if (noContactDeclining.length > 0) {
      alerts.push({
        id: 'communication-gap-critical',
        severity: 'attention',
        category: 'communication',
        title: 'Communication Gap Detected',
        description: `${noContactDeclining.length} worker${noContactDeclining.length > 1 ? 's' : ''} with declining performance ${noContactDeclining.length === 1 ? 'has' : 'have'} not been contacted recently.`,
        whyItMatters: 'Communication insights are observational correlations, not causal conclusions.',
        managerPrompt: 'Consider whether a check-in would be useful.',
        workerIds: noContactDeclining,
      });
    }

    if (lowContactDeclining.length > 0 && noContactDeclining.length === 0) {
      alerts.push({
        id: 'communication-low',
        severity: 'info',
        category: 'communication',
        title: 'Low Engagement During Decline',
        description: `${lowContactDeclining.length} worker${lowContactDeclining.length > 1 ? 's' : ''} ${lowContactDeclining.length === 1 ? 'has' : 'have'} limited recent contact during performance decline.`,
        whyItMatters: 'Increased engagement may correlate with performance stabilization.',
        managerPrompt: 'You may want to increase coaching touchpoints.',
        workerIds: lowContactDeclining,
      });
    }
  }

  // ========================================
  // 3️⃣ CAPACITY RISK ALERTS
  // ========================================
  
  if (targetCapacity && currentCapacity && currentCapacity < targetCapacity * 0.85) {
    alerts.push({
      id: 'capacity-risk',
      severity: 'risk',
      category: 'capacity',
      title: 'Delivery Risk',
      description: 'Current team capacity may not meet today\'s target at current pace.',
      whyItMatters: 'Production timeline may need adjustment or additional staffing.',
      managerPrompt: 'Consider adjusting target or requesting additional support.',
    });
  }

  if (presentWorkerIds.length < 3) {
    alerts.push({
      id: 'understaffed',
      severity: presentWorkerIds.length < 2 ? 'risk' : 'attention',
      category: 'capacity',
      title: 'Low Staffing',
      description: `Only ${presentWorkerIds.length} worker${presentWorkerIds.length !== 1 ? 's' : ''} present today.`,
      whyItMatters: 'Reduced staffing impacts capacity and may affect timelines.',
      managerPrompt: 'Review staffing plan for today\'s targets.',
    });
  }

  // Majority low predictability
  const avgPredictability = presentProfiles.length > 0
    ? presentProfiles.reduce((sum, p) => sum + calculatePredictability(p), 0) / presentProfiles.length
    : 0;
  
  if (avgPredictability < 50 && presentProfiles.length > 0) {
    alerts.push({
      id: 'team-predictability-low',
      severity: 'attention',
      category: 'capacity',
      title: 'Low Team Predictability',
      description: `Team average predictability is ${Math.round(avgPredictability)}%.`,
      whyItMatters: 'Forecast accuracy is reduced. Plan for variability.',
    });
  }

  // ========================================
  // 4️⃣ POSITIVE SIGNAL ALERTS
  // ========================================
  
  // Workers improving
  const improvingWorkers = presentProfiles.filter(
    p => p.trend_speed === 'improving' || p.trend_quality === 'improving'
  );
  
  if (improvingWorkers.length > 0) {
    // Check if any have recent communication
    let hasRecentComms = false;
    if (communicationStats) {
      hasRecentComms = improvingWorkers.some(w => {
        const stats = communicationStats.get(w.worker_id);
        return stats && stats.last7Days >= 3;
      });
    }

    if (hasRecentComms) {
      alerts.push({
        id: 'positive-engagement',
        severity: 'info',
        category: 'positive',
        title: 'Positive Momentum',
        description: 'Recent engagement coincides with improved output stability.',
        whyItMatters: 'Consistent coaching appears to correlate with performance gains.',
        managerPrompt: 'Continue current engagement approach.',
        workerIds: improvingWorkers.map(w => w.worker_id),
      });
    }
  }

  // High performers present
  const highPredictabilityWorkers = presentProfiles.filter(
    p => calculatePredictability(p) >= 75
  );
  
  if (highPredictabilityWorkers.length >= 2 && highPredictabilityWorkers.length >= presentProfiles.length * 0.5) {
    alerts.push({
      id: 'strong-team',
      severity: 'info',
      category: 'positive',
      title: 'Strong Team Today',
      description: `${highPredictabilityWorkers.length} highly predictable workers present.`,
      whyItMatters: 'High predictability enables accurate time estimates.',
      managerPrompt: 'These workers may be strong candidates for critical batches.',
      workerIds: highPredictabilityWorkers.map(w => w.worker_id),
    });
  }

  return alerts;
}

// ============================================
// WORKER-SPECIFIC PROMPTS
// ============================================

export function generateWorkerPrompts(
  profile: WorkerSkillProfile,
  communicationStats?: {
    daysSinceContact: number | null;
    last7Days: number;
  }
): WorkerPrompt[] {
  const prompts: WorkerPrompt[] = [];
  const predictability = calculatePredictability(profile);

  // Performance variability
  if (profile.trend_speed === 'declining' || profile.trend_quality === 'declining') {
    prompts.push({
      id: 'trend-declining',
      severity: 'attention',
      title: 'Performance variability increased',
      description: `${profile.trend_speed === 'declining' ? 'Speed' : 'Quality'} has declined in the last 7 days.`,
    });
  }

  // No recent communication during decline
  if (communicationStats && 
      (profile.trend_speed === 'declining' || profile.trend_quality === 'declining') &&
      (communicationStats.daysSinceContact === null || communicationStats.daysSinceContact > 7)) {
    prompts.push({
      id: 'no-contact-decline',
      severity: 'attention',
      title: 'No recent communication logged',
      description: 'No outbound contact during trend decline period.',
    });
  }

  // High predictability
  if (predictability >= 75) {
    prompts.push({
      id: 'high-predictability',
      severity: 'info',
      title: 'High predictability — reliable for planning',
      description: 'Consistent performance makes this worker ideal for critical assignments.',
    });
  }

  // Improving trend
  if (profile.trend_speed === 'improving' && profile.trend_quality === 'improving') {
    prompts.push({
      id: 'improving-both',
      severity: 'info',
      title: 'Both speed and quality improving',
      description: 'Positive trajectory across key metrics.',
    });
  }

  // High defect rate
  if ((profile.defect_rate_per_thousand || 0) > 15) {
    prompts.push({
      id: 'high-defects',
      severity: 'attention',
      title: 'Elevated defect rate',
      description: `Defect rate (${profile.defect_rate_per_thousand?.toFixed(1)}‰) exceeds standard threshold.`,
    });
  }

  return prompts;
}

// ============================================
// UI COMPONENTS
// ============================================

// Dark-mode contrast: /20 backgrounds on a dark floor rendered these alerts
// half-invisible. /60 backgrounds + 100-level text keep them readable.
const SEVERITY_CONFIG = {
  info: {
    border: 'border-blue-500/60',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    icon: <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />,
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  },
  attention: {
    border: 'border-amber-500/60',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />,
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  },
  risk: {
    border: 'border-red-500/60',
    bg: 'bg-red-50 dark:bg-red-950/60',
    icon: <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />,
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  },
};

const CATEGORY_ICONS = {
  performance: <TrendingDown className="h-4 w-4" />,
  communication: <MessageSquareOff className="h-4 w-4" />,
  capacity: <Users className="h-4 w-4" />,
  positive: <TrendingUp className="h-4 w-4" />,
};

interface SoftAlertCardProps {
  alert: SoftAlert;
  onDismiss: (id: string) => void;
}

export function SoftAlertCard({ alert, onDismiss }: SoftAlertCardProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const categoryIcon = CATEGORY_ICONS[alert.category];

  return (
    <Alert className={cn('relative pr-10', config.border, config.bg)}>
      <div className="flex items-start gap-2">
        {alert.category === 'positive' ? (
          <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
        ) : (
          <span className="mt-0.5">{config.icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-medium flex items-center gap-2">
            {alert.title}
            <Tooltip>
              <TooltipTrigger>
                <Lightbulb className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-medium mb-1">Why this matters:</p>
                <p className="text-xs text-muted-foreground">{alert.whyItMatters}</p>
              </TooltipContent>
            </Tooltip>
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {alert.description}
          </AlertDescription>
          {alert.managerPrompt && (
            <p className="text-xs text-primary/80 mt-1 italic">
              💡 {alert.managerPrompt}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => onDismiss(alert.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}

interface SoftAlertPanelProps {
  alerts: SoftAlert[];
  maxVisible?: number;
  className?: string;
}

export function SoftAlertPanel({ alerts, maxVisible = 3, className }: SoftAlertPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  const visibleAlerts = useMemo(() => {
    return alerts
      .filter(a => !dismissedIds.has(a.id))
      .sort((a, b) => {
        const severityOrder = { risk: 0, attention: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }, [alerts, dismissedIds]);

  if (visibleAlerts.length === 0) return null;

  const displayedAlerts = isExpanded ? visibleAlerts : visibleAlerts.slice(0, maxVisible);
  const hiddenCount = visibleAlerts.length - maxVisible;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lightbulb className="h-3 w-3" />
          Alerts surface patterns for awareness, not conclusions.
        </span>
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3 ml-1" />
              </>
            ) : (
              <>
                +{hiddenCount} more <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Alerts */}
      {displayedAlerts.map(alert => (
        <SoftAlertCard
          key={alert.id}
          alert={alert}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

interface WorkerPromptBadgesProps {
  prompts: WorkerPrompt[];
  className?: string;
}

export function WorkerPromptBadges({ prompts, className }: WorkerPromptBadgesProps) {
  if (prompts.length === 0) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {prompts.map(prompt => {
        const config = SEVERITY_CONFIG[prompt.severity];
        return (
          <div
            key={prompt.id}
            className={cn(
              'flex items-start gap-2 px-3 py-2 rounded-lg text-sm',
              config.bg,
              config.border,
              'border'
            )}
          >
            {prompt.severity === 'info' ? (
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium text-xs">{prompt.title}</p>
              <p className="text-xs text-muted-foreground">{prompt.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
