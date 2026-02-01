/**
 * GROUPED COMMUNICATION VIEW
 * 
 * Groups communications by worker for easy tracking.
 */

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  User, 
  ChevronDown,
  MessageSquare,
  Phone
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CommunicationTimelineEntry } from './CommunicationTimelineEntry';

interface CommunicationEntry {
  id: string;
  channel: string;
  direction: string;
  status: string;
  message_body?: string;
  phone_used?: string;
  created_at: string;
  error_message?: string;
  batch_id?: string;
  worker_id?: string;
  worker?: {
    id: string;
    full_name: string;
    role?: string;
  } | null;
}

interface GroupedCommunicationViewProps {
  communications: CommunicationEntry[];
  onWorkerClick: (worker: CommunicationEntry['worker']) => void;
  onQuickContact: (worker: CommunicationEntry['worker'], channel: 'sms' | 'call') => void;
}

interface WorkerGroup {
  workerId: string;
  workerName: string;
  workerRole?: string;
  communications: CommunicationEntry[];
  lastContactAt: string;
  totalCount: number;
}

export function GroupedCommunicationView({ 
  communications, 
  onWorkerClick,
  onQuickContact 
}: GroupedCommunicationViewProps) {
  // Group by worker
  const groups = useMemo(() => {
    const groupMap = new Map<string, WorkerGroup>();
    
    // Also track "Unknown" group for entries without workers
    const unknownGroup: WorkerGroup = {
      workerId: 'unknown',
      workerName: 'Unknown / No Worker',
      communications: [],
      lastContactAt: '',
      totalCount: 0,
    };

    communications.forEach((comm) => {
      if (comm.worker) {
        const existing = groupMap.get(comm.worker.id);
        if (existing) {
          existing.communications.push(comm);
          existing.totalCount++;
          if (new Date(comm.created_at) > new Date(existing.lastContactAt)) {
            existing.lastContactAt = comm.created_at;
          }
        } else {
          groupMap.set(comm.worker.id, {
            workerId: comm.worker.id,
            workerName: comm.worker.full_name,
            workerRole: comm.worker.role,
            communications: [comm],
            lastContactAt: comm.created_at,
            totalCount: 1,
          });
        }
      } else {
        unknownGroup.communications.push(comm);
        unknownGroup.totalCount++;
        if (!unknownGroup.lastContactAt || new Date(comm.created_at) > new Date(unknownGroup.lastContactAt)) {
          unknownGroup.lastContactAt = comm.created_at;
        }
      }
    });

    // Sort groups by most recent contact
    const sorted = Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime()
    );

    // Add unknown group at the end if it has entries
    if (unknownGroup.totalCount > 0) {
      sorted.push(unknownGroup);
    }

    return sorted;
  }, [communications]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No communications to display</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-3">
        {groups.map((group) => (
          <Collapsible key={group.workerId} defaultOpen={groups.length <= 5}>
            <div className="border rounded-lg">
              <CollapsibleTrigger asChild>
                <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{group.workerName}</p>
                      {group.workerRole && (
                        <p className="text-xs text-muted-foreground capitalize">{group.workerRole}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <Badge variant="secondary" className="mr-2">
                        {group.totalCount} message{group.totalCount !== 1 ? 's' : ''}
                      </Badge>
                      {formatDistanceToNow(new Date(group.lastContactAt), { addSuffix: true })}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t p-3 space-y-2 bg-muted/20">
                  {/* Quick actions bar */}
                  {group.workerId !== 'unknown' && (
                    <div className="flex gap-2 pb-2 border-b">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onQuickContact({ 
                          id: group.workerId, 
                          full_name: group.workerName,
                          role: group.workerRole 
                        }, 'sms')}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Text
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onQuickContact({ 
                          id: group.workerId, 
                          full_name: group.workerName,
                          role: group.workerRole 
                        }, 'call')}
                      >
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onWorkerClick({ 
                          id: group.workerId, 
                          full_name: group.workerName,
                          role: group.workerRole 
                        })}
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                  
                  {/* Communications for this worker */}
                  <div className="space-y-2">
                    {group.communications.slice(0, 10).map((comm) => (
                      <CommunicationTimelineEntry
                        key={comm.id}
                        entry={comm}
                        onWorkerClick={onWorkerClick}
                        onQuickContact={onQuickContact}
                      />
                    ))}
                    {group.communications.length > 10 && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        + {group.communications.length - 10} more messages
                      </p>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}
