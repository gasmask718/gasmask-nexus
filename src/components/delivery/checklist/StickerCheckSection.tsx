import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Sticker } from 'lucide-react';
import { CANONICAL_BRAND_IDS, getBrandIdentity } from '@/config/brands';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { cn } from '@/lib/utils';

interface StickerCheckSectionProps {
  storeId: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  stickerData: Record<string, any>;
  onStickerUpdate: (data: Record<string, any>) => void;
}

export function StickerCheckSection({
  storeId,
  isTaskCompleted,
  onToggleTask,
  progress,
  stickerData,
  onStickerUpdate,
}: StickerCheckSectionProps) {
  const tasks = getTasksByCategory('stickers');
  const [brandStickers, setBrandStickers] = useState<Record<string, boolean>>(
    stickerData.brandStickers || {}
  );

  const toggleBrandSticker = (brandId: string) => {
    const updated = { ...brandStickers, [brandId]: !brandStickers[brandId] };
    setBrandStickers(updated);
    onStickerUpdate({ ...stickerData, brandStickers: updated });
  };

  return (
    <ChecklistSection
      title="Stickers & Visibility"
      icon={<Sticker className="h-5 w-5" />}
      category="stickers"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      accentColor="text-violet-500"
    >
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Brand Stickers Present
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CANONICAL_BRAND_IDS.map((brandId) => {
            const brand = getBrandIdentity(brandId);
            const present = brandStickers[brandId] || false;
            return (
              <button
                key={brandId}
                onClick={() => toggleBrandSticker(brandId)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border text-left transition-colors',
                  present
                    ? `${brand.softBgClass} ${brand.borderClass}`
                    : 'hover:bg-muted/50'
                )}
              >
                <span className="text-sm">{brand.icon}</span>
                <span className={cn('text-xs font-medium flex-1', present ? brand.textClass : 'text-muted-foreground')}>
                  {brand.shortName || brand.displayName}
                </span>
                {present && (
                  <span className="text-xs text-green-500">✓</span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Camera className="h-3 w-3" />
          Take Sticker Photo
        </Button>
      </div>
    </ChecklistSection>
  );
}
