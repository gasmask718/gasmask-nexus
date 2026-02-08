import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Package } from 'lucide-react';
import { CANONICAL_BRANDS, CANONICAL_BRAND_IDS, getBrandIdentity } from '@/config/brands';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { cn } from '@/lib/utils';

interface InventoryCheckSectionProps {
  storeId: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  inventoryData: Record<string, any>;
  onInventoryUpdate: (data: Record<string, any>) => void;
}

export function InventoryCheckSection({
  storeId,
  isTaskCompleted,
  onToggleTask,
  progress,
  inventoryData,
  onInventoryUpdate,
}: InventoryCheckSectionProps) {
  const tasks = getTasksByCategory('inventory');
  const [counts, setCounts] = useState<Record<string, number>>(
    inventoryData.brandCounts || {}
  );

  const handleCountChange = (brandId: string, value: number) => {
    const updated = { ...counts, [brandId]: value };
    setCounts(updated);
    onInventoryUpdate({ ...inventoryData, brandCounts: updated });
  };

  return (
    <ChecklistSection
      title="Inventory Verification"
      icon={<Package className="h-5 w-5" />}
      category="inventory"
      tasks={tasks}
      progress={progress}
      isTaskCompleted={isTaskCompleted}
      onToggleTask={onToggleTask}
      defaultExpanded={true}
      accentColor="text-amber-500"
    >
      {/* Inline tube count inputs per brand */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tube Counts per Brand
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {CANONICAL_BRAND_IDS.map((brandId) => {
            const brand = getBrandIdentity(brandId);
            return (
              <div key={brandId} className={cn('flex items-center gap-2 p-2 rounded-lg', brand.softBgClass)}>
                <span className="text-sm">{brand.icon}</span>
                <span className={cn('text-xs font-medium flex-1', brand.textClass)}>
                  {brand.shortName || brand.displayName}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={counts[brandId] || ''}
                  onChange={(e) => handleCountChange(brandId, parseInt(e.target.value) || 0)}
                  className="w-16 h-7 text-xs text-center"
                  placeholder="0"
                />
              </div>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Camera className="h-3 w-3" />
          Take Inventory Photo
        </Button>
      </div>
    </ChecklistSection>
  );
}
