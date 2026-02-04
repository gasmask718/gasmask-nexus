// ═══════════════════════════════════════════════════════════════════════════════
// STORE ESCALATIONS BOARD — Route candidates from unresponsive outreach
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Phone, 
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Route,
  Clock
} from 'lucide-react';
import { 
  usePendingEscalations,
  useAssignEscalation,
  useResolveEscalation,
  useDismissEscalation,
  type StoreEscalation
} from '@/hooks/useStoreEscalations';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface StoreEscalationsBoardProps {
  className?: string;
  onAddToRoute?: (storeIds: string[]) => void;
}

export function StoreEscalationsBoard({ className, onAddToRoute }: StoreEscalationsBoardProps) {
  const navigate = useNavigate();
  const { data: escalations = [], isLoading } = usePendingEscalations();
  const resolveEscalation = useResolveEscalation();
  const dismissEscalation = useDismissEscalation();
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [activeEscalation, setActiveEscalation] = useState<StoreEscalation | null>(null);
  const [notes, setNotes] = useState('');

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === escalations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(escalations.map(e => e.id));
    }
  };

  const handleAddToRoute = () => {
    const storeIds = escalations
      .filter(e => selectedIds.includes(e.id))
      .map(e => e.store_id);
    
    if (onAddToRoute) {
      onAddToRoute(storeIds);
    } else {
      // Navigate to route planner with stores
      navigate('/delivery/routes', { state: { selectedStoreIds: storeIds } });
    }
  };

  const handleResolve = async () => {
    if (!activeEscalation) return;
    await resolveEscalation.mutateAsync({
      escalationId: activeEscalation.id,
      notes,
    });
    setResolveDialogOpen(false);
    setActiveEscalation(null);
    setNotes('');
  };

  const handleDismiss = async () => {
    if (!activeEscalation) return;
    await dismissEscalation.mutateAsync({
      escalationId: activeEscalation.id,
      notes,
    });
    setDismissDialogOpen(false);
    setActiveEscalation(null);
    setNotes('');
  };

  const priorityColors = {
    high: 'bg-red-500/10 text-red-500 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const getPriorityLevel = (priority: number) => {
    if (priority <= 3) return 'high';
    if (priority <= 6) return 'medium';
    return 'low';
  };

  const reasonLabels = {
    unresponsive: 'Unresponsive',
    at_risk: 'At Risk',
    high_value: 'High Value',
    manual: 'Manual',
  };

  if (isLoading) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Needs Physical Visit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("glass-card border-border/50", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Needs Physical Visit
              </CardTitle>
              <CardDescription>
                Stores escalated after failed outreach attempts
              </CardDescription>
            </div>
            {escalations.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.length === escalations.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedIds.length > 0 && (
                  <Button size="sm" onClick={handleAddToRoute}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Add to Route ({selectedIds.length})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {escalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No stores need physical visits</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {escalations.map((escalation) => (
                  <EscalationCard
                    key={escalation.id}
                    escalation={escalation}
                    isSelected={selectedIds.includes(escalation.id)}
                    onToggleSelect={() => handleToggleSelect(escalation.id)}
                    onResolve={() => {
                      setActiveEscalation(escalation);
                      setResolveDialogOpen(true);
                    }}
                    onDismiss={() => {
                      setActiveEscalation(escalation);
                      setDismissDialogOpen(true);
                    }}
                    onViewStore={() => navigate(`/stores/${escalation.store_id}`)}
                    priorityColors={priorityColors}
                    getPriorityLevel={getPriorityLevel}
                    reasonLabels={reasonLabels}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Escalation</DialogTitle>
            <DialogDescription>
              Mark this store as visited and resolved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Store</p>
              <p className="text-muted-foreground">{activeEscalation?.store?.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was the outcome of the visit?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolveEscalation.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Escalation</DialogTitle>
            <DialogDescription>
              Remove this store from the visit queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Store</p>
              <p className="text-muted-foreground">{activeEscalation?.store?.name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for dismissal</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this being dismissed?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDismiss} 
              disabled={dismissEscalation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface EscalationCardProps {
  escalation: StoreEscalation;
  isSelected: boolean;
  onToggleSelect: () => void;
  onResolve: () => void;
  onDismiss: () => void;
  onViewStore: () => void;
  priorityColors: Record<string, string>;
  getPriorityLevel: (priority: number) => string;
  reasonLabels: Record<string, string>;
}

function EscalationCard({
  escalation,
  isSelected,
  onToggleSelect,
  onResolve,
  onDismiss,
  onViewStore,
  priorityColors,
  getPriorityLevel,
  reasonLabels,
}: EscalationCardProps) {
  const priorityLevel = getPriorityLevel(escalation.priority);

  return (
    <div 
      className={cn(
        "border rounded-lg p-4 space-y-3 transition-colors cursor-pointer",
        isSelected ? "bg-primary/5 border-primary/30" : "bg-card/50 hover:bg-card"
      )}
      onClick={onToggleSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1" onClick={(e) => { e.stopPropagation(); onViewStore(); }}>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium hover:underline cursor-pointer">
              {escalation.store?.name || 'Unknown Store'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {escalation.store?.address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={priorityColors[priorityLevel]}>
            P{escalation.priority}
          </Badge>
          <Badge variant="outline">
            {reasonLabels[escalation.reason] || escalation.reason}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Phone className="h-3.5 w-3.5" />
          {escalation.attempts_made} attempts
        </div>
        <div className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {escalation.contacts_attempted} contacts
        </div>
        {escalation.last_attempt_at && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Last {formatDistanceToNow(new Date(escalation.last_attempt_at), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={onViewStore}>
          View Store
        </Button>
        <Button size="sm" variant="outline" onClick={onResolve}>
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Resolve
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <XCircle className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}
