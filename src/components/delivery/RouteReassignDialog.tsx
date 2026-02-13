import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { useDispatchActions } from '@/hooks/useDispatchInterventions';

interface RouteReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  routeDate: string;
  currentAssigneeName: string;
  workerType: 'driver' | 'biker';
  onReassigned?: () => void;
}

export const RouteReassignDialog: React.FC<RouteReassignDialogProps> = ({
  open,
  onOpenChange,
  routeId,
  routeDate,
  currentAssigneeName,
  workerType,
  onReassigned,
}) => {
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const { reassignRoute } = useDispatchActions();

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-for-reassign', workerType],
    queryFn: async () => {
      const table = workerType === 'driver' ? 'drivers' : 'bikers';
      const { data, error } = await supabase
        .from(table)
        .select('id, full_name, user_id')
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleReassign = () => {
    const worker = workers.find((w) => w.id === newAssigneeId);
    reassignRoute.mutate(
      { routeId, newAssigneeId: worker?.user_id || newAssigneeId, reason },
      {
        onSuccess: () => {
          onOpenChange(false);
          setNewAssigneeId('');
          setReason('');
          onReassigned?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Reassign Route
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Route date:</span>
            <Badge variant="outline">{routeDate}</Badge>
            <span className="text-muted-foreground">Currently:</span>
            <span className="font-medium">{currentAssigneeName}</span>
          </div>

          <div className="space-y-2">
            <Label>Reassign to</Label>
            <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose ${workerType}...`} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason for reassignment</Label>
            <Textarea
              placeholder="Why is this route being reassigned?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={handleReassign}
              disabled={!newAssigneeId || !reason.trim() || reassignRoute.isPending}
              className="flex-1"
            >
              {reassignRoute.isPending ? 'Reassigning...' : 'Reassign Route'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteReassignDialog;
