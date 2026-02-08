import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, ExternalLink, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { BrandCRMStoreRow } from '@/hooks/useBrandCRMAnalytics';

interface BrandExecutionPanelProps {
  stores: BrandCRMStoreRow[];
  isLoading: boolean;
  brandColor: string;
}

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    healthy: { label: '🟢 Healthy', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    'at-risk': { label: '🟡 At Risk', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    critical: { label: '🔴 Critical', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    new: { label: '🔵 New', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  };
  const c = config[status] || config.new;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function VelocityBadge({ velocity }: { velocity: string }) {
  const config: Record<string, string> = {
    Fast: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Slow: 'bg-destructive/15 text-destructive border-destructive/30',
    New: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge variant="outline" className={config[velocity] || config.New}>
      {velocity}
    </Badge>
  );
}

export function BrandExecutionPanel({ stores, isLoading, brandColor }: BrandExecutionPanelProps) {
  const navigate = useNavigate();

  const overdueStores = stores
    .filter(s => s.is_overdue)
    .sort((a, b) => (b.days_since_last_order || 0) - (a.days_since_last_order || 0))
    .slice(0, 10);

  const criticalStores = stores
    .filter(s => s.health_status === 'critical' && !s.is_overdue)
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Execution Priorities</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (overdueStores.length === 0 && criticalStores.length === 0) {
    return (
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground">✅ No urgent actions — all stores are on track for this brand.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Overdue Stores */}
      {overdueStores.length > 0 && (
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue Reorders ({overdueStores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {overdueStores.map(store => (
              <div
                key={store.store_id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{store.store_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {store.city && <span>{store.city}</span>}
                    <span>•</span>
                    <span className="text-destructive font-medium">
                      {store.days_since_last_order}d overdue
                    </span>
                    <VelocityBadge velocity={store.order_frequency_class} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/store-master/${store.store_id}`)}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Critical Stores */}
      {criticalStores.length > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-500" />
              Critical Health ({criticalStores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {criticalStores.map(store => (
              <div
                key={store.store_id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{store.store_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {store.city && <span>{store.city}</span>}
                    <HealthBadge status={store.health_status} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/store-master/${store.store_id}`)}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
