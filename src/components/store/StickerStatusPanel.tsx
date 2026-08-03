// ═══════════════════════════════════════════════════════════════════════════
// STICKER STATUS PANEL — SINGLE SHARED SURFACE
//
// The store profile AND the Edit Contact Information modal both render this
// component. There is exactly ONE sticker implementation (BrandStickersCard,
// backed by store_brand_stickers + useBrandStickers) and exactly ONE brand
// list (STICKER_BRANDS in useBrandStickers). Do not add a second one.
// ═══════════════════════════════════════════════════════════════════════════

import { BrandStickersCard } from '@/components/store/BrandStickersCard';
import { TubeIntelRole } from '@/hooks/useTubeIntelligence';
import { cn } from '@/lib/utils';

interface StickerStatusPanelProps {
  storeId: string;
  /** view = profile card, edit = inside the Edit Contact Information modal */
  mode?: 'view' | 'edit';
  role?: TubeIntelRole;
  className?: string;
}

export function StickerStatusPanel({
  storeId,
  mode = 'view',
  role = 'admin',
  className,
}: StickerStatusPanelProps) {
  if (!storeId) return null;

  if (mode === 'edit') {
    return (
      <div
        className={cn(
          // scrollable + overflow-safe so no row is clipped inside the modal
          'max-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg border border-border/40 [&_.glass-card]:border-0',
          className
        )}
      >
        <div className="min-w-0 [&>*]:border-0 [&>*]:shadow-none">
          <BrandStickersCard storeId={storeId} role={role} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      <BrandStickersCard storeId={storeId} role={role} />
    </div>
  );
}
