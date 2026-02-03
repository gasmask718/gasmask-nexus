/**
 * QuickStatsStickersSummary - Canonical Brand Stickers Quick Stats Display
 * 
 * READ-ONLY summary of sticker status for all brands.
 * Uses the canonical store_brand_stickers table as single source of truth.
 * 
 * Shows:
 * - Aggregate compliance: X / (4 × brands)
 * - Total requested stickers
 * - Per-brand breakdown with all 4 sticker types
 */

import { useBrandStickers, STICKER_TYPES, BrandStickerStatus } from '@/hooks/useBrandStickers';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, X, Package, Sticker } from 'lucide-react';

interface QuickStatsStickersSummaryProps {
  storeId: string;
}

type StickerTypeId = typeof STICKER_TYPES[number]['id'];

/**
 * Get sticker status: installed, requested, or missing
 */
function getStickerStatus(
  record: BrandStickerStatus,
  stickerType: StickerTypeId
): 'installed' | 'requested' | 'missing' {
  const installed = record[stickerType];
  const requestedKey = `requested_${stickerType}` as keyof BrandStickerStatus;
  const requested = record[requestedKey];
  
  if (installed) return 'installed';
  if (requested) return 'requested';
  return 'missing';
}

/**
 * Single sticker status indicator
 */
function StickerIndicator({ 
  status, 
  label 
}: { 
  status: 'installed' | 'requested' | 'missing';
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{label}</span>
      <div className="flex items-center">
        {status === 'installed' && (
          <div className="h-2 w-2 rounded-full bg-green-500" title="Installed" />
        )}
        {status === 'requested' && (
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Requested" />
        )}
        {status === 'missing' && (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" title="Not installed" />
        )}
      </div>
    </div>
  );
}

/**
 * Brand row with all 4 stickers
 */
function BrandStickerRow({ record }: { record: BrandStickerStatus }) {
  const installedCount = STICKER_TYPES.filter(
    type => record[type.id as StickerTypeId]
  ).length;

  const requestedCount = STICKER_TYPES.filter(
    type => record[`requested_${type.id}` as keyof BrandStickerStatus]
  ).length;

  return (
    <div className="p-2 rounded-md bg-muted/30 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{record.brand_name}</span>
        <div className="flex items-center gap-1">
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] h-4 px-1",
              installedCount === 4 
                ? "bg-green-500/10 text-green-600 border-green-500/30"
                : installedCount > 0
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {installedCount}/4
          </Badge>
          {requestedCount > 0 && (
            <Badge 
              variant="outline" 
              className="text-[10px] h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-500/30"
            >
              <Package className="h-2 w-2 mr-0.5" />
              {requestedCount}
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {STICKER_TYPES.map(type => (
          <StickerIndicator
            key={type.id}
            status={getStickerStatus(record, type.id)}
            label={type.name.replace(' Sticker', '')}
          />
        ))}
      </div>
    </div>
  );
}

export function QuickStatsStickersSummary({ storeId }: QuickStatsStickersSummaryProps) {
  const { data: stickerData, isLoading } = useBrandStickers(storeId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!stickerData || stickerData.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Sticker className="h-4 w-4" />
          Brand Stickers
        </p>
        <div className="p-3 rounded-md bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">No sticker data recorded yet</p>
        </div>
      </div>
    );
  }

  // Calculate aggregate stats
  const totalBrands = stickerData.length;
  const totalPossible = totalBrands * 4;
  
  let totalInstalled = 0;
  let totalRequested = 0;
  
  stickerData.forEach(record => {
    STICKER_TYPES.forEach(type => {
      if (record[type.id as StickerTypeId]) totalInstalled++;
      const requestedKey = `requested_${type.id}` as keyof BrandStickerStatus;
      if (record[requestedKey]) totalRequested++;
    });
  });

  const compliancePercent = totalPossible > 0 
    ? Math.round((totalInstalled / totalPossible) * 100) 
    : 0;

  return (
    <div className="space-y-3">
      {/* Header with label */}
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Sticker className="h-4 w-4" />
        Brand Stickers
      </p>
      
      {/* Aggregate Summary Line */}
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/50">
        <div className="flex items-center gap-2">
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-xs font-medium">Compliance</span>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            compliancePercent === 100 
              ? "bg-green-500/10 text-green-600 border-green-500/30"
              : compliancePercent >= 50
              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
              : "bg-muted text-muted-foreground"
          )}
        >
          {totalInstalled} / {totalPossible} ({compliancePercent}%)
        </Badge>
      </div>

      {/* Requested Summary (if any) */}
      {totalRequested > 0 && (
        <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <Package className="h-3 w-3 text-amber-500" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Requested</span>
          </div>
          <Badge 
            variant="outline" 
            className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
          >
            {totalRequested} sticker{totalRequested !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {/* Per-Brand Breakdown */}
      <div className="space-y-2">
        {stickerData.map(record => (
          <BrandStickerRow key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
}
