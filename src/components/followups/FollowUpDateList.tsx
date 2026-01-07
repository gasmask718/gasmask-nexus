import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Mail, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarFollowUp } from './FollowUpCalendarView';

interface FollowUpDateListProps {
  followUps: CalendarFollowUp[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export const FollowUpDateList = ({ followUps, selectedIds, onSelectionChange }: FollowUpDateListProps) => {
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
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

  if (followUps.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No follow-ups on this date</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {followUps.map((followUp) => (
        <Card
          key={followUp.id}
          className={cn(
            'p-4 cursor-pointer transition-all hover:shadow-md',
            selectedIds.has(followUp.id) && 'ring-2 ring-primary bg-primary/5'
          )}
          onClick={() => toggleSelection(followUp.id)}
        >
          <div className="flex items-center gap-4">
            <Checkbox
              checked={selectedIds.has(followUp.id)}
              onCheckedChange={() => toggleSelection(followUp.id)}
              className="h-5 w-5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{followUp.storeName}</p>
                <Badge variant="outline" className="shrink-0 gap-1.5">
                  {getActionIcon(followUp.actionType)}
                  <span className="capitalize">{followUp.actionType}</span>
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {followUp.reason}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
