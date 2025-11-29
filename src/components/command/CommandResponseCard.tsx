import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  UserPlus, Send, Route, FileDown, Bell, Flag, ExternalLink
} from 'lucide-react';
import { CommandResponse, QueryResult } from '@/lib/commands/CommandEngine';
import { ActionIntent } from '@/lib/commands/IntentRegistry';
import { formatDistanceToNow } from 'date-fns';

interface CommandResponseCardProps {
  response: CommandResponse;
  selectedResults: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExecuteAction: (action: ActionIntent, params?: Record<string, unknown>) => void;
}

const ACTION_BUTTONS: { action: ActionIntent; label: string; icon: React.ReactNode; variant?: 'default' | 'secondary' | 'outline' }[] = [
  { action: 'assign', label: 'Assign', icon: <UserPlus className="h-3 w-3" /> },
  { action: 'route', label: 'Send to Route', icon: <Route className="h-3 w-3" /> },
  { action: 'text', label: 'Send Text', icon: <Send className="h-3 w-3" /> },
  { action: 'notify', label: 'Notify', icon: <Bell className="h-3 w-3" />, variant: 'secondary' },
  { action: 'escalate', label: 'Escalate', icon: <Flag className="h-3 w-3" />, variant: 'secondary' },
  { action: 'export', label: 'Export', icon: <FileDown className="h-3 w-3" />, variant: 'outline' },
];

export function CommandResponseCard({
  response,
  selectedResults,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onExecuteAction,
}: CommandResponseCardProps) {
  const [expanded, setExpanded] = useState(true);
  const hasSelection = selectedResults.size > 0;
  const allSelected = response.results.length > 0 && selectedResults.size === response.results.length;

  const StatusIcon = response.status === 'completed' 
    ? CheckCircle 
    : response.status === 'error' 
    ? AlertCircle 
    : Clock;

  const statusColor = response.status === 'completed' 
    ? 'text-green-500' 
    : response.status === 'error' 
    ? 'text-red-500' 
    : 'text-yellow-500';

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon className={`h-4 w-4 ${statusColor}`} />
              <span className="text-sm font-medium text-muted-foreground">
                {response.command.originalText}
              </span>
            </div>
            <CardTitle className="text-base">{response.summary}</CardTitle>
            {response.command.isShortcut && (
              <Badge variant="outline" className="mt-1 text-xs">Shortcut</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(response.timestamp), { addSuffix: true })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Results List */}
          {response.results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => allSelected ? onClearSelection() : onSelectAll()}
                  />
                  <span className="text-sm text-muted-foreground">
                    {hasSelection ? `${selectedResults.size} selected` : 'Select all'}
                  </span>
                </div>
                <Badge variant="secondary">{response.results.length} results</Badge>
              </div>

              <ScrollArea className="h-[200px] rounded border">
                <div className="p-2 space-y-1">
                  {response.results.map((result) => (
                    <ResultRow
                      key={result.id}
                      result={result}
                      isSelected={selectedResults.has(result.id)}
                      onToggle={() => onToggleSelection(result.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {response.status === 'error' && (
            <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
              {response.error}
            </div>
          )}

          {/* Action Buttons */}
          {response.results.length > 0 && response.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {ACTION_BUTTONS.filter((btn) => response.suggestedActions.includes(btn.action)).map((btn) => (
                <Button
                  key={btn.action}
                  size="sm"
                  variant={btn.variant || 'default'}
                  onClick={() => onExecuteAction(btn.action)}
                  disabled={!hasSelection && response.results.length > 5}
                >
                  {btn.icon}
                  <span className="ml-1">{btn.label}</span>
                  {hasSelection && <span className="ml-1">({selectedResults.size})</span>}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ResultRow({
  result,
  isSelected,
  onToggle,
}: {
  result: QueryResult;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10' : ''
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={isSelected} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{result.title}</div>
        {result.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
        )}
      </div>
      <Badge variant="outline" className="text-xs shrink-0">
        {result.type}
      </Badge>
    </div>
  );
}
