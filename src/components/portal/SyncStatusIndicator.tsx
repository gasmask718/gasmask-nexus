/**
 * Sync Status Indicator - Shows offline queue status in portal UI
 * Phase 3: Offline-Ready, Crypto-Signed, Zero-Trust Edge Execution
 */

import { useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { type SyncStatus, type QueuedAction } from '@/lib/offlineQueue';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  hasCrypto: boolean;
  onSync: () => Promise<void>;
  onRetryFailed: () => Promise<void>;
  getFailedActions: () => Promise<QueuedAction[]>;
}

export function SyncStatusIndicator({
  status,
  hasCrypto,
  onSync,
  onRetryFailed,
  getFailedActions,
}: SyncStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [failedActions, setFailedActions] = useState<QueuedAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleExpandToggle = async (open: boolean) => {
    setIsExpanded(open);
    if (open && status.failedCount > 0) {
      const failed = await getFailedActions();
      setFailedActions(failed);
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    try {
      await onSync();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await onRetryFailed();
      setFailedActions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-amber-500';
    if (status.failedCount > 0) return 'bg-red-500';
    if (status.queuedCount > 0 || status.sendingCount > 0) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return <CloudOff className="h-4 w-4" />;
    if (status.isSyncing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (status.failedCount > 0) return <AlertCircle className="h-4 w-4" />;
    if (status.queuedCount > 0) return <RefreshCw className="h-4 w-4" />;
    return <Cloud className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.isSyncing) return 'Syncing...';
    if (status.failedCount > 0) return `${status.failedCount} failed`;
    if (status.queuedCount > 0) return `${status.queuedCount} queued`;
    return 'Synced';
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={handleExpandToggle}>
      <div className="rounded-lg border bg-card p-3">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {getStatusIcon()}
                {getStatusText()}
              </span>
              {hasCrypto && (
                <Badge variant="outline" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {status.lastSyncAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3">
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-muted p-2">
                <div className="text-lg font-bold">{status.queuedCount}</div>
                <div className="text-xs text-muted-foreground">Queued</div>
              </div>
              <div className="rounded bg-muted p-2">
                <div className="text-lg font-bold">{status.sendingCount}</div>
                <div className="text-xs text-muted-foreground">Sending</div>
              </div>
              <div className="rounded bg-muted p-2">
                <div className={`text-lg font-bold ${status.failedCount > 0 ? 'text-red-500' : ''}`}>
                  {status.failedCount}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={!status.isOnline || status.isSyncing || isLoading}
                className="flex-1"
              >
                {isLoading || status.isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync Now
              </Button>
              {status.failedCount > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Retry Failed
                </Button>
              )}
            </div>

            {/* Failed actions list */}
            {failedActions.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Failed Actions</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {failedActions.map((action) => (
                    <div
                      key={action.id}
                      className="text-xs p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                    >
                      <div className="font-medium">{action.action_type}</div>
                      <div className="text-muted-foreground">
                        {action.last_error || 'Unknown error'}
                      </div>
                      <div className="text-muted-foreground">
                        Retries: {action.retry_count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline message */}
            {!status.isOnline && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 p-2 rounded">
                You're offline. Actions will sync when connection is restored.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
