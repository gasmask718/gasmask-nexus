/**
 * IntelligenceROIDashboard — Phase V Internal Diagnostics
 * 
 * Admin-only view showing:
 * 1. Exposure → Communication correlation rates
 * 2. Channel alignment (did users follow suggestions?)
 * 3. Confidence calibration (is "High" actually better?)
 * 
 * READ-ONLY. No actions. No nudging. Internal accountability only.
 */

import { BarChart3, TrendingUp, Shield, ShieldAlert, ShieldQuestion, Activity, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExposureCorrelation, useConfidenceCalibration } from '@/hooks/useIntelligenceROI';
import { cn } from '@/lib/utils';

interface IntelligenceROIDashboardProps {
  storeId?: string;
  className?: string;
}

export function IntelligenceROIDashboard({ storeId, className }: IntelligenceROIDashboardProps) {
  const { data: correlation, isLoading: corrLoading } = useExposureCorrelation(storeId, 30);
  const { data: calibration, isLoading: calLoading } = useConfidenceCalibration(90);

  const isLoading = corrLoading || calLoading;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Intelligence Accountability</h3>
        <span className="text-xs text-muted-foreground ml-auto">Phase V · Internal Diagnostics</span>
      </div>

      {/* Exposure → Behavior Correlation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Exposure → Behavior Correlation
            <span className="text-xs text-muted-foreground font-normal ml-auto">Last 30 days</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : !correlation || correlation.total_exposures === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No exposure data yet. Intelligence views will be tracked automatically.
            </p>
          ) : (
            <div className="space-y-3">
              <MetricRow
                label="Total Intelligence Exposures"
                value={correlation.total_exposures.toString()}
              />
              <MetricRow
                label="Communication within 24h"
                value={`${correlation.followed_by_communication_24h} (${pct(correlation.correlation_rate_24h)})`}
                quality={correlation.correlation_rate_24h > 0.4 ? 'good' : correlation.correlation_rate_24h > 0.2 ? 'neutral' : 'low'}
              />
              <MetricRow
                label="Communication within 48h"
                value={`${correlation.followed_by_communication_48h} (${pct(correlation.correlation_rate_48h)})`}
                quality={correlation.correlation_rate_48h > 0.5 ? 'good' : correlation.correlation_rate_48h > 0.3 ? 'neutral' : 'low'}
              />
              <MetricRow
                label="Suggested Channel Used"
                value={`${correlation.suggested_channel_used} (${pct(correlation.channel_alignment_rate)})`}
                quality={correlation.channel_alignment_rate > 0.5 ? 'good' : 'neutral'}
              />
              <MetricRow
                label="Suggested Contact Reached"
                value={correlation.suggested_contact_reached.toString()}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence Calibration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Confidence Calibration
            <span className="text-xs text-muted-foreground font-normal ml-auto">Last 90 days</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : !calibration || calibration.length === 0 || calibration.every(c => c.total_exposures === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No confidence calibration data yet. Requires best contact exposures with confidence levels.
            </p>
          ) : (
            <div className="space-y-3">
              {calibration.map(bucket => (
                <CalibrationRow key={bucket.level} bucket={bucket} />
              ))}

              {/* Falsification check */}
              <FalsificationCheck calibration={calibration} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* What Would Falsify */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Honest Failure Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• If High confidence has ≤ Low confidence response rate → scoring is broken</li>
            <li>• If channel alignment is &lt;20% → suggestions aren't useful or visible</li>
            <li>• If 24h correlation is &lt;10% → intelligence isn't driving behavior</li>
            <li>• If no exposures exist after 7 days → tracking integration is broken</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function MetricRow({
  label,
  value,
  quality,
}: {
  label: string;
  value: string;
  quality?: 'good' | 'neutral' | 'low';
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        'font-medium',
        quality === 'good' && 'text-green-600 dark:text-green-400',
        quality === 'low' && 'text-red-600 dark:text-red-400',
      )}>
        {value}
      </span>
    </div>
  );
}

function CalibrationRow({ bucket }: { bucket: { level: string; total_exposures: number; response_rate: number; avg_time_to_response_hours: number | null } }) {
  const icons: Record<string, typeof Shield> = {
    high: Shield,
    medium: ShieldAlert,
    low: ShieldQuestion,
  };
  const Icon = icons[bucket.level] || ShieldQuestion;

  const colors: Record<string, string> = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-muted-foreground',
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <Icon className={cn('h-4 w-4 shrink-0', colors[bucket.level])} />
      <div className="flex-1">
        <span className="font-medium capitalize">{bucket.level}</span>
        <span className="text-muted-foreground ml-2">({bucket.total_exposures} exposures)</span>
      </div>
      <div className="text-right">
        <span className={cn('font-medium', colors[bucket.level])}>
          {pct(bucket.response_rate)} response
        </span>
        {bucket.avg_time_to_response_hours != null && (
          <span className="text-muted-foreground ml-1">
            · avg {bucket.avg_time_to_response_hours.toFixed(1)}h
          </span>
        )}
      </div>
    </div>
  );
}

function FalsificationCheck({ calibration }: { calibration: { level: string; response_rate: number; total_exposures: number }[] }) {
  const high = calibration.find(c => c.level === 'high');
  const low = calibration.find(c => c.level === 'low');

  if (!high || !low || high.total_exposures < 5 || low.total_exposures < 5) {
    return (
      <p className="text-[10px] text-muted-foreground italic pt-1">
        Insufficient data for calibration validation. Need ≥5 exposures per confidence level.
      </p>
    );
  }

  const isCalibrated = high.response_rate > low.response_rate;

  return (
    <div className={cn(
      'rounded-md px-2 py-1.5 text-[10px] font-medium border mt-1',
      isCalibrated
        ? 'bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400'
        : 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400'
    )}>
      {isCalibrated
        ? `✓ Calibration valid: High confidence (${pct(high.response_rate)}) outperforms Low (${pct(low.response_rate)})`
        : `⚠ Calibration failure: High confidence (${pct(high.response_rate)}) ≤ Low (${pct(low.response_rate)}) — scoring needs review`
      }
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
