import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Eye, Shield, Ban } from 'lucide-react';

/**
 * SHADOW MODE ENFORCEMENT COMPONENTS
 * 
 * These components enforce the Phase 9.1 mandate:
 * - AI operates in SHADOW MODE ONLY
 * - AI may recommend, analyze, summarize
 * - AI may NOT execute anything automatically
 */

// Global Shadow Mode Banner - displays on all Floor 9 pages
export function ShadowModeBanner() {
  return (
    <Card className="border-2 border-yellow-500/50 bg-yellow-500/10">
      <CardContent className="py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-yellow-500" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-yellow-500">SHADOW MODE ACTIVE</span>
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                Phase 9.1
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              AI observes and recommends only — All actions require human approval
            </p>
          </div>
        </div>
        <Shield className="h-6 w-6 text-yellow-500/50" />
      </CardContent>
    </Card>
  );
}

// Badge that marks any AI output as "Recommendation - Not Executed"
export function RecommendationOnlyBadge({ className }: { className?: string }) {
  return (
    <Badge 
      variant="outline" 
      className={`border-yellow-500 text-yellow-500 bg-yellow-500/10 ${className}`}
    >
      <Eye className="h-3 w-3 mr-1" />
      Recommendation — Not Executed
    </Badge>
  );
}

// Blocker for any "Accept All" or bulk approval actions
export function NoAutoAcceptWarning() {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
      <Ban className="h-4 w-4 text-red-500 flex-shrink-0" />
      <span className="text-red-500 font-medium">
        Bulk acceptance is disabled — Each action requires individual review
      </span>
    </div>
  );
}

// Warning when rejecting without feedback
export function RejectFeedbackRequired({ onProvide }: { onProvide: () => void }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-500">Feedback Required</p>
        <p className="text-xs text-muted-foreground">
          Rejection requires minimum 1 sentence explanation for AI learning
        </p>
      </div>
      <button 
        onClick={onProvide}
        className="text-sm text-red-500 hover:underline font-medium"
      >
        Add Feedback
      </button>
    </div>
  );
}

// Governance rules display
export function ShadowModeGovernanceRules() {
  const rules = [
    { icon: Ban, text: 'No auto-execution allowed', severity: 'critical' },
    { icon: Ban, text: 'No "Accept All" actions', severity: 'critical' },
    { icon: AlertTriangle, text: 'Every rejection requires explanation', severity: 'warning' },
    { icon: AlertTriangle, text: 'Every modification requires justification', severity: 'warning' },
    { icon: Shield, text: 'All decisions are logged permanently', severity: 'info' },
    { icon: Eye, text: 'AI confidence is monitored for drift', severity: 'info' },
  ];

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Shadow Mode Governance Rules
        </h4>
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <rule.icon className={`h-4 w-4 ${
                rule.severity === 'critical' ? 'text-red-500' :
                rule.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
              }`} />
              <span className="text-muted-foreground">{rule.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Immutability notice for logs
export function ImmutableLogNotice() {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
      <Shield className="h-3 w-3" />
      <span>This log is immutable and permanently recorded for audit purposes</span>
    </div>
  );
}
