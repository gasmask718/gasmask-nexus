import { useTranslation } from "@/hooks/useTranslation";
import { BilingualLabel } from "@/components/portal/BilingualLabel";
/**
 * ACTIVE BATCH BANNER
 * 
 * Displays the currently active batch at the top of the portal.
 * Shows batch info, status, and quick actions.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProductionBatch } from '@/hooks/useProductionPortal';
import { Boxes, Play, AlertTriangle, Clock, Scale, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ActiveBatchBannerProps {
  batches: ProductionBatch[];
  onSelectBatch?: (batch: ProductionBatch) => void;
  onCreateBatch?: () => void;
}

const BRAND_LABELS: Record<string, string> = {
  gasmask: 'Gasmask',
  hotmama: 'HotMama',
  hotscolati: 'Hotscolatti',
  'grabba-rus': 'GrabbaRus',
};

const BRAND_COLORS: Record<string, string> = {
  gasmask: 'bg-emerald-500',
  hotmama: 'bg-pink-500',
  hotscolati: 'bg-amber-500',
  'grabba-rus': 'bg-purple-500',
};

export function ActiveBatchBanner({ batches, onSelectBatch, onCreateBatch }: ActiveBatchBannerProps) {
  const { t } = useTranslation();
  // Find active batch (open or in_progress)
  const activeBatch = batches.find(b => b.status === 'in_progress') || batches.find(b => b.status === 'open');
  const todayBatches = batches.filter(b => b.status !== 'cancelled');
  
  if (todayBatches.length === 0) {
    return (
      <Card className="mb-4 border-dashed border-amber-300 bg-amber-50/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800"><BilingualLabel tKey="production.no_active_batch" en="No Active Batch" /></p>
                <p className="text-sm text-amber-600">
                  {t("production.no_active_batch_description")}
                </p>
              </div>
            </div>
            <Button onClick={onCreateBatch}>
              <Boxes className="h-4 w-4 mr-2" />
              <BilingualLabel tKey="production.create_batch" en="Create Batch" inline />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeBatch) {
    // All batches are completed
    return (
      <Card className="mb-4 border-emerald-200 bg-emerald-50/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-800">
                  <BilingualLabel tKey="production.all_batches_completed" en="All Batches Completed" /> ({todayBatches.length} today)
                </p>
                <p className="text-sm text-emerald-600">
                  {t("production.all_batches_completed_description")}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onCreateBatch}>
              <Boxes className="h-4 w-4 mr-2" />
              <BilingualLabel tKey="production.new_batch" en="New Batch" inline />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const createdAt = activeBatch.created_at ? format(new Date(activeBatch.created_at), 'h:mm a') : '';
  const isInProgress = activeBatch.status === 'in_progress';

  return (
    <Card className={cn(
      "mb-4 border-2",
      isInProgress ? "border-primary/50 bg-primary/5" : "border-blue-200 bg-blue-50/50"
    )}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className={cn(
              "p-2 rounded-full",
              isInProgress ? "bg-primary/20" : "bg-blue-100"
            )}>
              {isInProgress ? (
                <Play className="h-5 w-5 text-primary" />
              ) : (
                <Boxes className="h-5 w-5 text-blue-600" />
              )}
            </div>
            
            {/* Batch Info */}
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', BRAND_COLORS[activeBatch.brand])} />
                  <span className="font-semibold">
                    {BRAND_LABELS[activeBatch.brand] || activeBatch.brand}
                  </span>
                  <Badge variant="outline">{activeBatch.shift_label}</Badge>
                  <Badge className={cn(
                    isInProgress 
                      ? "bg-primary/20 text-primary" 
                      : "bg-blue-100 text-blue-800"
                  )}>
                    {isInProgress ? <BilingualLabel tKey="production.status.in_progress" en="In Progress" inline /> : <BilingualLabel tKey="production.status.open" en="Open" inline />}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t("production.started")} {createdAt}
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-4 ml-4 pl-4 border-l">
                <div className="text-center">
                  <p className="text-lg font-bold">{activeBatch.tobacco_lbs || 0}</p>
                  <p className="text-xs text-muted-foreground">{t("production.lbs")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{(activeBatch.tubes_total || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t("production.tubes_issued_qty")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">{(activeBatch.boxes_produced || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{t("production.boxes_produced")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onSelectBatch?.(activeBatch)}
            >
              <BilingualLabel tKey="production.batch_details" en="View Details" inline />
            </Button>
            {todayBatches.length > 1 && (
              <Badge variant="secondary">
                +{todayBatches.length - 1} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
