import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Phone, MessageSquare, Mail, Building2, CheckSquare, Square } from 'lucide-react';
import { format, isToday, isPast } from 'date-fns';
import { ExportToRouteButton } from './ExportToRouteButton';
import { cn } from '@/lib/utils';

export interface StoreFollowUp {
  id: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  dueAt: Date;
  reason: string;
  actionType: string;
  status: 'overdue' | 'pending' | 'upcoming';
}

interface FollowUpFilterViewProps {
  followUps: StoreFollowUp[];
  isLoading?: boolean;
}

export const FollowUpFilterView = ({ followUps, isLoading }: FollowUpFilterViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === followUps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(followUps.map(f => f.id)));
    }
  };

  const selectedStoreIds = useMemo(() => {
    return followUps
      .filter(f => selectedIds.has(f.id))
      .map(f => f.storeId)
      .filter((id, index, self) => self.indexOf(id) === index); // unique
  }, [followUps, selectedIds]);

  const getStatusBadge = (status: StoreFollowUp['status']) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-xs">Due Today</Badge>;
      case 'upcoming':
        return <Badge variant="secondary" className="text-xs">Upcoming</Badge>;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'sms':
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No stores with follow-ups</p>
        <p className="text-muted-foreground mt-1">All follow-ups are complete</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Select All */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="lg"
          onClick={selectAll}
          className="h-12 text-base gap-2"
        >
          {selectedIds.size === followUps.length ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Square className="h-5 w-5" />
          )}
          {selectedIds.size === followUps.length ? 'Clear' : 'Select All'}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selectedIds.size} of {followUps.length} selected
        </span>
      </div>

      {/* Store List */}
      <div className="space-y-3">
        {followUps.map((followUp) => (
          <Card
            key={followUp.id}
            className={cn(
              'p-4 cursor-pointer transition-all hover:shadow-md',
              selectedIds.has(followUp.id) && 'ring-2 ring-primary bg-primary/5',
              followUp.status === 'overdue' && 'border-destructive/30',
              followUp.status === 'pending' && 'border-amber-500/30'
            )}
            onClick={() => toggleSelection(followUp.id)}
          >
            <div className="flex items-start gap-4">
              <Checkbox
                checked={selectedIds.has(followUp.id)}
                onCheckedChange={() => toggleSelection(followUp.id)}
                className="mt-1 h-5 w-5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{followUp.storeName}</p>
                    {followUp.storeAddress && (
                      <p className="text-sm text-muted-foreground truncate">{followUp.storeAddress}</p>
                    )}
                  </div>
                  {getStatusBadge(followUp.status)}
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(followUp.dueAt, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {getActionIcon(followUp.actionType)}
                    <span className="capitalize">{followUp.actionType}</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground truncate">{followUp.reason}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Export Button */}
      <div className="sticky bottom-4 pt-4">
        <ExportToRouteButton 
          storeIds={selectedStoreIds}
          followUpDate={selectedIds.size > 0 
            ? followUps.find(f => selectedIds.has(f.id))?.dueAt 
            : undefined
          }
        />
      </div>
    </div>
  );
};
