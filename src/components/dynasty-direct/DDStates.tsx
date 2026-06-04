/**
 * One loading + error + empty language for every Dynasty Direct surface.
 * Use DDFetchState({ query, ... }) as a wrapper, or compose individual parts.
 */
import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Inbox, RefreshCw, LucideIcon } from 'lucide-react';

export function DDSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3 items-center">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DDErrorCard({
  error,
  onRetry,
  title = 'Could not load',
}: { error: unknown; onRetry?: () => void; title?: string }) {
  const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return (
    <Card className="border-destructive/50">
      <CardContent className="p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{msg}</div>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function DDEmpty({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  secondary,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  secondary?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="rounded-full bg-primary/10 text-primary p-3 mb-3">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground max-w-md mt-1">{description}</p>}
        {actionLabel && (
          <div className="mt-4 flex items-center gap-2">
            {actionHref ? (
              <Button asChild><a href={actionHref}>{actionLabel}</a></Button>
            ) : (
              <Button onClick={onAction}>{actionLabel}</Button>
            )}
            {secondary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
