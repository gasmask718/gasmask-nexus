import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Route } from 'lucide-react';
import { SendToRouteModal } from '@/components/scheduling/SendToRouteModal';
import { format } from 'date-fns';

interface ExportToRouteButtonProps {
  storeIds: string[];
  followUpDate?: Date;
  className?: string;
}

export const ExportToRouteButton = ({ storeIds, followUpDate, className }: ExportToRouteButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Button
        size="lg"
        className="w-full h-14 text-lg gap-3"
        disabled={storeIds.length === 0}
        onClick={() => setIsModalOpen(true)}
      >
        <Route className="h-6 w-6" />
        Export to Route {storeIds.length > 0 && `(${storeIds.length})`}
      </Button>

      <SendToRouteModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        storeIds={storeIds}
        onSuccess={handleSuccess}
      />
    </>
  );
};
