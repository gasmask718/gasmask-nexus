import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bike, MapPin, UserPlus, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface BikerAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'store' | 'route' | 'issue';
  entityId?: string;
  entityName?: string;
  currentBikerId?: string;
  onAssigned?: () => void;
}

export const BikerAssignmentDialog: React.FC<BikerAssignmentDialogProps> = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  currentBikerId,
  onAssigned
}) => {
  const queryClient = useQueryClient();
  const [selectedBikerId, setSelectedBikerId] = useState(currentBikerId || '');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Fetch active bikers
  const { data: bikers = [] } = useQuery({
    queryKey: ['active-bikers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bikers')
        .select('id, full_name, territory, status')
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Create store check assignment
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (entityType === 'store') {
        // Create new store check
        const { error } = await supabase.from('store_checks').insert({
          location_id: entityId,
          assigned_biker_id: selectedBikerId,
          scheduled_date: scheduledDate,
          check_type: 'inventory_check',
          status: 'assigned',
          summary_notes: notes || null
        } as any);
        if (error) throw error;
      } else if (entityType === 'issue') {
        // Update existing store check with new biker
        const { error } = await supabase
          .from('store_checks')
          .update({ 
            assigned_biker_id: selectedBikerId,
            status: 'assigned'
          })
          .eq('id', entityId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-checks'] });
      queryClient.invalidateQueries({ queryKey: ['bikers'] });
      toast.success(`${entityType === 'store' ? 'Store check assigned' : 'Task reassigned'} successfully`);
      onOpenChange(false);
      onAssigned?.();
      setSelectedBikerId('');
      setNotes('');
    },
    onError: () => {
      toast.error('Failed to assign task');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {currentBikerId ? 'Reassign Task' : 'Assign Biker'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {entityName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{entityName}</p>
                <Badge variant="outline" className="text-xs capitalize">
                  {entityType}
                </Badge>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Biker</Label>
            <Select value={selectedBikerId} onValueChange={setSelectedBikerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a biker..." />
              </SelectTrigger>
              <SelectContent>
                {bikers.map(biker => (
                  <SelectItem key={biker.id} value={biker.id}>
                    <div className="flex items-center gap-2">
                      <Bike className="h-4 w-4" />
                      <span>{biker.full_name}</span>
                      {biker.territory && (
                        <span className="text-muted-foreground text-xs">({biker.territory})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityType === 'store' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Scheduled Date
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={!selectedBikerId || assignMutation.isPending}
              className="flex-1"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BikerAssignmentDialog;
