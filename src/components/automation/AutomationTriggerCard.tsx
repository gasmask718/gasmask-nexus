import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Clock, Zap } from 'lucide-react';
import { AutomationRule } from '@/lib/automation/AutomationEngine';
import { formatDistanceToNow } from 'date-fns';

interface AutomationTriggerCardProps {
  rule: AutomationRule;
  onToggle: (enabled: boolean) => void;
  onExecute: () => void;
  disabled?: boolean;
}

export function AutomationTriggerCard({
  rule,
  onToggle,
  onExecute,
  disabled = false,
}: AutomationTriggerCardProps) {
  return (
    <Card className={`transition-all ${rule.isEnabled ? 'border-primary/50' : 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap className={`h-4 w-4 ${rule.isEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              <h4 className="font-medium text-sm truncate">{rule.name}</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
              {rule.description}
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {rule.trigger.replace(/_/g, ' ')}
              </Badge>
              {rule.actions.slice(0, 2).map((action) => (
                <Badge key={action} variant="secondary" className="text-xs">
                  {action.replace(/_/g, ' ')}
                </Badge>
              ))}
              {rule.actions.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{rule.actions.length - 2}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Switch
              checked={rule.isEnabled}
              onCheckedChange={onToggle}
              disabled={disabled}
            />
            {rule.isEnabled && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onExecute}
                disabled={disabled}
                className="h-7 px-2"
              >
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>
            )}
          </div>
        </div>

        {(rule.lastRun || rule.runCount > 0) && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {rule.lastRun
                ? `Last: ${formatDistanceToNow(new Date(rule.lastRun), { addSuffix: true })}`
                : 'Never run'}
            </span>
            <span>{rule.runCount} executions</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
