import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MoreVertical,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Flag,
  ArrowUp,
  Ticket,
  CalendarIcon,
} from "lucide-react";
import { useWorkOwnershipActions, WorkItem } from "@/hooks/useWorkOwnership";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface WorkOwnershipActionsProps {
  item: WorkItem;
  onConvertToTicket?: () => void;
}

export function WorkOwnershipActions({ item, onConvertToTicket }: WorkOwnershipActionsProps) {
  const actions = useWorkOwnershipActions();
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [snoozeReason, setSnoozeReason] = useState("");
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>(undefined);

  const handleEscalate = async () => {
    if (!escalationReason) return;
    await actions.escalate(item.id, "", escalationReason);
    setShowEscalateDialog(false);
    setEscalationReason("");
  };

  const handleSnooze = async () => {
    if (!snoozeDate) return;
    await actions.snooze(item.id, snoozeDate, snoozeReason);
    setShowSnoozeDialog(false);
    setSnoozeReason("");
    setSnoozeDate(undefined);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => actions.assign(item.id, "")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign to Me
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => actions.resolve(item.id)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Resolved
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowEscalateDialog(true)}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Escalate
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowSnoozeDialog(true)}>
            <Clock className="h-4 w-4 mr-2" />
            Snooze
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag className="h-4 w-4 mr-2" />
              Set Priority
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => actions.setPriority(item.id, "urgent")}>
                <Badge variant="destructive" className="mr-2">Urgent</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setPriority(item.id, "high")}>
                <Badge className="mr-2 bg-orange-500">High</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setPriority(item.id, "normal")}>
                <Badge variant="secondary" className="mr-2">Normal</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setPriority(item.id, "low")}>
                <Badge variant="outline" className="mr-2">Low</Badge>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Set Status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => actions.setStatus(item.id, "open")}>
                Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setStatus(item.id, "in_progress")}>
                In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setStatus(item.id, "waiting")}>
                Waiting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.setStatus(item.id, "resolved")}>
                Resolved
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {onConvertToTicket && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onConvertToTicket}>
                <Ticket className="h-4 w-4 mr-2" />
                Convert to Ticket
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Escalate Dialog */}
      <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate Item</DialogTitle>
            <DialogDescription>
              Escalate this item to a manager or supervisor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Escalation Reason</Label>
              <Textarea
                placeholder="Why is this being escalated?"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEscalateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEscalate} disabled={!escalationReason}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={showSnoozeDialog} onOpenChange={setShowSnoozeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze Item</DialogTitle>
            <DialogDescription>
              Temporarily hide this item until a specific date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Snooze Until</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !snoozeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {snoozeDate ? format(snoozeDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={snoozeDate}
                    onSelect={setSnoozeDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="Why is this being snoozed?"
                value={snoozeReason}
                onChange={(e) => setSnoozeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnoozeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSnooze} disabled={!snoozeDate}>
              <Clock className="h-4 w-4 mr-2" />
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  const variants: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string }> = {
    urgent: { variant: "destructive", label: "Urgent" },
    high: { variant: "default", label: "High" },
    normal: { variant: "secondary", label: "Normal" },
    low: { variant: "outline", label: "Low" },
  };
  
  const config = variants[priority || "normal"] || variants.normal;
  
  return (
    <Badge variant={config.variant} className={priority === "high" ? "bg-orange-500" : undefined}>
      {config.label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    open: { variant: "default", label: "Open" },
    in_progress: { variant: "secondary", label: "In Progress" },
    waiting: { variant: "outline", label: "Waiting" },
    resolved: { variant: "outline", label: "Resolved" },
    escalated: { variant: "destructive", label: "Escalated" },
    snoozed: { variant: "outline", label: "Snoozed" },
  };
  
  const config = variants[status || "open"] || variants.open;
  
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function SLATimer({ deadline, firstResponse }: { deadline?: string; firstResponse?: string }) {
  if (!deadline) return null;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  const isOverdue = diff < 0;
  const isWarning = !isOverdue && hours < 1;
  
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs",
      isOverdue && "text-destructive",
      isWarning && !isOverdue && "text-orange-500",
      !isOverdue && !isWarning && "text-muted-foreground"
    )}>
      <Clock className="h-3 w-3" />
      {isOverdue ? (
        <span>Overdue by {Math.abs(hours)}h {Math.abs(minutes)}m</span>
      ) : (
        <span>{hours}h {minutes}m remaining</span>
      )}
    </div>
  );
}
