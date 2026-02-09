/**
 * StoreDangerZone — Danger zone section for store profile pages.
 * Only visible to users with 'owner' role.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { DeleteStoreModal } from './DeleteStoreModal';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';

interface StoreDangerZoneProps {
  storeId: string;
  storeName: string;
  sourceUi?: string;
}

export function StoreDangerZone({ storeId, storeName, sourceUi = 'store_master_profile' }: StoreDangerZoneProps) {
  const { user } = useAuth();
  const { roles } = useUserRole(user?.id);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Only show to owner
  const isOwner = roles.includes('owner');
  if (!isOwner) return null;

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Deleting a store removes it from all operations, KPIs, routes, and CRM surfaces.
            This action is logged and recoverable by the owner.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Store
          </Button>
        </CardContent>
      </Card>

      <DeleteStoreModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        storeId={storeId}
        storeName={storeName}
        sourceUi={sourceUi}
      />
    </>
  );
}
