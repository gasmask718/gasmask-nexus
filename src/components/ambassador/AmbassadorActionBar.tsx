import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Store, ClipboardList, Calendar, UserPlus, 
  MessageSquare, Power, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface AmbassadorActionBarProps {
  ambassadorId: string;
  ambassadorName: string;
  isActive: boolean;
  onAddStore?: () => void;
  onLogVisit?: () => void;
  onScheduleFollowUp?: () => void;
  onAssignStore?: () => void;
  onMessage?: () => void;
  onToggleStatus?: () => void;
}

export const AmbassadorActionBar: React.FC<AmbassadorActionBarProps> = ({
  ambassadorId,
  ambassadorName,
  isActive,
  onAddStore,
  onLogVisit,
  onScheduleFollowUp,
  onAssignStore,
  onMessage,
  onToggleStatus
}) => {
  const handleAction = (action: string, callback?: () => void) => {
    if (callback) {
      callback();
    } else {
      toast.info(`${action} - Coming soon`);
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 -mx-6 -mb-6 mt-6">
      <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto">
        <Button 
          variant="default"
          onClick={() => handleAction('Add Store', onAddStore)}
          className="gap-2"
        >
          <Store className="h-4 w-4" />
          Add Store
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction('Log Visit', onLogVisit)}
          className="gap-2"
        >
          <ClipboardList className="h-4 w-4" />
          Log Visit
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction('Schedule Follow-Up', onScheduleFollowUp)}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Schedule Follow-Up
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction('Assign Store', onAssignStore)}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Assign Store
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => handleAction('Message', onMessage)}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleAction('Toggle Status', onToggleStatus)}>
              <Power className="h-4 w-4 mr-2" />
              {isActive ? 'Deactivate' : 'Activate'} Ambassador
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              View Activity Log
            </DropdownMenuItem>
            <DropdownMenuItem className="text-muted-foreground">
              Export Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
