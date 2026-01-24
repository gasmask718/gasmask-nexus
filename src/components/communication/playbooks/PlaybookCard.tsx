import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  BookOpen,
  Target,
  Shield,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SalesPlaybook } from '@/hooks/usePlaybooks';

interface PlaybookCardProps {
  playbook: SalesPlaybook;
  onToggleActive: (id: string, active: boolean) => void;
  onSetDefault: (id: string) => void;
  onEdit: (playbook: SalesPlaybook) => void;
}

export function PlaybookCard({
  playbook,
  onToggleActive,
  onSetDefault,
  onEdit,
}: PlaybookCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getPerformanceBadge = () => {
    if (!playbook.avg_outcome_score) return null;
    if (playbook.avg_outcome_score >= 80) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">High Performer</Badge>;
    }
    if (playbook.avg_outcome_score >= 60) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Moderate</Badge>;
    }
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Needs Review</Badge>;
  };

  return (
    <Card className={cn(
      'transition-all',
      playbook.is_default && 'ring-2 ring-primary',
      !playbook.is_active && 'opacity-60'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              playbook.is_active ? 'bg-primary/10' : 'bg-muted'
            )}>
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{playbook.name}</h3>
                {playbook.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </Badge>
                )}
              </div>
              {playbook.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {playbook.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getPerformanceBadge()}
            <Switch
              checked={playbook.is_active}
              onCheckedChange={(checked) => onToggleActive(playbook.id, checked)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>{playbook.target_intents.length} intents</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{Math.floor(playbook.max_duration_seconds / 60)}m max</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span>{playbook.confidence_floor}% floor</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>{playbook.times_used} uses</span>
          </div>
        </div>

        {/* Intents */}
        <div className="flex flex-wrap gap-1">
          {playbook.target_intents.slice(0, 5).map((intent) => (
            <Badge key={intent} variant="outline" className="text-xs">
              {intent}
            </Badge>
          ))}
          {playbook.target_intents.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{playbook.target_intents.length - 5} more
            </Badge>
          )}
        </div>

        {/* Expandable Details */}
        {expanded && (
          <div className="pt-4 border-t space-y-4">
            {/* Allowed Tactics */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Allowed Tactics
              </h4>
              <div className="flex flex-wrap gap-1">
                {playbook.allowed_tactics.map((tactic) => (
                  <Badge key={tactic} className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                    {tactic}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Forbidden Tactics */}
            {playbook.forbidden_tactics.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Forbidden Tactics
                </h4>
                <div className="flex flex-wrap gap-1">
                  {playbook.forbidden_tactics.map((tactic) => (
                    <Badge key={tactic} className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                      {tactic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Escalation Triggers */}
            {playbook.escalation_triggers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Escalation Triggers</h4>
                <div className="flex flex-wrap gap-1">
                  {playbook.escalation_triggers.map((trigger) => (
                    <Badge key={trigger} variant="outline" className="text-xs">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">
                  {playbook.avg_outcome_score?.toFixed(0) ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Outcome Score</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">
                  {playbook.conversion_rate ? `${(playbook.conversion_rate * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Conversion Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Details
              </>
            )}
          </Button>
          <div className="flex gap-2">
            {!playbook.is_default && playbook.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetDefault(playbook.id)}
              >
                Set Default
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(playbook)}
            >
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
