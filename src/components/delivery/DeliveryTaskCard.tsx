import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ClipboardList, AlertTriangle } from 'lucide-react';
import { useDeliveryChecklist } from '@/hooks/useDeliveryChecklist';
import { InventoryCheckSection } from './checklist/InventoryCheckSection';
import { OrderDeliverySection } from './checklist/OrderDeliverySection';
import { LastOrderContextSection } from './checklist/LastOrderContextSection';
import { GrowthCaptureSection } from './checklist/GrowthCaptureSection';
import { ContactUpdateSection } from './checklist/ContactUpdateSection';
import { StickerCheckSection } from './checklist/StickerCheckSection';

interface DeliveryTaskCardProps {
  storeId: string;
  storeName?: string;
  onComplete?: () => void;
}

export function DeliveryTaskCard({ storeId, storeName, onComplete }: DeliveryTaskCardProps) {
  const {
    checklist,
    isLoading,
    initChecklist,
    toggleTask,
    updateSectionData,
    completeChecklist,
    isTaskCompleted,
    getCategoryProgress,
    completedCount,
    totalTasks,
    allRequiredDone,
    progressPercent,
  } = useDeliveryChecklist(storeId);

  // Auto-init checklist on mount
  useEffect(() => {
    if (!isLoading && !checklist) {
      initChecklist.mutate();
    }
  }, [isLoading, checklist]);

  const handleToggleTask = (taskKey: string, completed: boolean) => {
    toggleTask.mutate({ taskKey, completed });
  };

  const handleComplete = () => {
    if (!allRequiredDone) return;
    completeChecklist.mutate(undefined, {
      onSuccess: () => onComplete?.(),
    });
  };

  const isCompleted = checklist?.status === 'completed';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <Card className={isCompleted ? 'border-green-500/50 bg-green-500/5' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Delivery Task Checklist</CardTitle>
            </div>
            {isCompleted ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge variant="outline">
                {completedCount}/{totalTasks}
              </Badge>
            )}
          </div>
          {storeName && (
            <p className="text-sm text-muted-foreground mt-1">{storeName}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} of {totalTasks} tasks</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* 1. Inventory Verification */}
      <InventoryCheckSection
        storeId={storeId}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={handleToggleTask}
        progress={getCategoryProgress('inventory')}
        inventoryData={checklist?.inventory_updates || {}}
        onInventoryUpdate={(data) => updateSectionData.mutate({ section: 'inventory_updates', data })}
      />

      {/* 2. Orders to Deliver */}
      <OrderDeliverySection
        storeId={storeId}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={handleToggleTask}
        progress={getCategoryProgress('orders')}
        orderData={checklist?.order_confirmations || {}}
        onOrderUpdate={(data) => updateSectionData.mutate({ section: 'order_confirmations', data })}
      />

      {/* 3. Last Order Context (Read-only) */}
      <LastOrderContextSection storeId={storeId} />

      {/* 4. Growth & Opportunities */}
      <GrowthCaptureSection
        storeId={storeId}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={handleToggleTask}
        progress={getCategoryProgress('growth')}
        growthData={checklist?.growth_captures || {}}
        onGrowthUpdate={(data) => updateSectionData.mutate({ section: 'growth_captures', data })}
      />

      {/* 5. Contact Intelligence */}
      <ContactUpdateSection
        storeId={storeId}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={handleToggleTask}
        progress={getCategoryProgress('contacts')}
        contactData={checklist?.contact_updates || {}}
        onContactUpdate={(data) => updateSectionData.mutate({ section: 'contact_updates', data })}
      />

      {/* 6. Stickers & Visibility */}
      <StickerCheckSection
        storeId={storeId}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={handleToggleTask}
        progress={getCategoryProgress('stickers')}
        stickerData={checklist?.sticker_status || {}}
        onStickerUpdate={(data) => updateSectionData.mutate({ section: 'sticker_status', data })}
      />

      {/* Complete Checklist Button */}
      {!isCompleted && (
        <Card className={allRequiredDone ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {allRequiredDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {allRequiredDone ? 'Ready to complete!' : 'Complete required tasks'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {allRequiredDone 
                      ? 'All required tasks are done' 
                      : 'Some required tasks are still pending'}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleComplete}
                disabled={!allRequiredDone || completeChecklist.isPending}
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete Visit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
