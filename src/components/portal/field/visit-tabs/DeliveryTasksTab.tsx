import { DeliveryTaskCard } from '@/components/delivery/DeliveryTaskCard';

interface DeliveryTasksTabProps {
  storeId: string;
  storeName?: string;
}

export function DeliveryTasksTab({ storeId, storeName }: DeliveryTasksTabProps) {
  return (
    <DeliveryTaskCard 
      storeId={storeId} 
      storeName={storeName}
    />
  );
}
