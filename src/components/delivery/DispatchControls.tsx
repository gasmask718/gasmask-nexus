// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH CONTROLS PANEL — Floor 4 Phase 3
// Real-time intervention controls for route operations
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowRightLeft,
  Pause,
  Play,
  XCircle,
  Plus,
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  Scissors,
  UserPlus,
  Shield,
} from "lucide-react";
import { useDispatchActions, useRecentInterventions } from "@/hooks/useDispatchInterventions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DispatchControlsProps {
  routeId: string;
  currentStatus: string;
  currentAssignee?: { id: string; name: string };
  onActionComplete?: () => void;
}

export function DispatchControls({ 
  routeId, 
  currentStatus, 
  currentAssignee,
  onActionComplete 
}: DispatchControlsProps) {
  const {
    reassignRoute,
    pauseRoute,
    resumeRoute,
    cancelRoute,
    addEmergencyStop,
  } = useDispatchActions();
  
  const [dialogType, setDialogType] = useState<
    'reassign' | 'cancel' | 'emergency_stop' | null
  >(null);
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  
  // Fetch available workers
  const { data: workers } = useQuery({
    queryKey: ['available-workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['driver', 'biker', 'ambassador']);
      if (error) throw error;
      return data;
    },
  });
  
  // Fetch stores for emergency stop
  const { data: stores } = useQuery({
    queryKey: ['available-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address_city')
        .eq('approval_status', 'approved') // Phase 7: exclude pending captures
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  
  const handlePause = async () => {
    await pauseRoute.mutateAsync({ 
      routeId, 
      reason: 'Paused by dispatcher' 
    });
    onActionComplete?.();
  };
  
  const handleResume = async () => {
    await resumeRoute.mutateAsync({ 
      routeId, 
      reason: 'Resumed by dispatcher' 
    });
    onActionComplete?.();
  };
  
  const handleReassign = async () => {
    if (!selectedAssignee || !reason.trim()) return;
    
    await reassignRoute.mutateAsync({
      routeId,
      newAssigneeId: selectedAssignee,
      reason: reason.trim(),
    });
    
    closeDialog();
    onActionComplete?.();
  };
  
  const handleCancel = async () => {
    if (!reason.trim() || !justification.trim()) return;
    
    await cancelRoute.mutateAsync({
      routeId,
      reason: reason.trim(),
      justification: justification.trim(),
    });
    
    closeDialog();
    onActionComplete?.();
  };
  
  const handleEmergencyStop = async () => {
    if (!selectedStore || !reason.trim()) return;
    
    await addEmergencyStop.mutateAsync({
      routeId,
      storeId: selectedStore,
      reason: reason.trim(),
      priority: 'emergency',
    });
    
    closeDialog();
    onActionComplete?.();
  };
  
  const closeDialog = () => {
    setDialogType(null);
    setReason("");
    setJustification("");
    setSelectedAssignee("");
    setSelectedStore("");
  };
  
  const isPaused = currentStatus === 'paused';
  const isActive = currentStatus === 'in_progress';
  const canPause = isActive;
  const canResume = isPaused;
  
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        {canPause && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePause}
            disabled={pauseRoute.isPending}
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
        )}
        
        {canResume && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResume}
            disabled={resumeRoute.isPending}
          >
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setDialogType('reassign')}
        >
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          Reassign
        </Button>
        
        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialogType('emergency_stop')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Emergency Stop
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-500"
              onClick={() => setDialogType('cancel')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Route
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Reassign Dialog */}
      <Dialog open={dialogType === 'reassign'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Reassign Route
            </DialogTitle>
            <DialogDescription>
              Transfer this route to a different worker. This action is logged.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {currentAssignee && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Currently assigned to:</p>
                <p className="font-medium">{currentAssignee.name}</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">New Assignee</label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker..." />
                </SelectTrigger>
                <SelectContent>
                  {workers?.filter(w => w.id !== currentAssignee?.id).map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.name} ({worker.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Reason (required)</label>
              <Input
                placeholder="Why is this reassignment needed?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleReassign}
              disabled={!selectedAssignee || !reason.trim() || reassignRoute.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cancel Dialog */}
      <Dialog open={dialogType === 'cancel'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              Cancel Route
            </DialogTitle>
            <DialogDescription>
              This is a destructive action. All stops will be unassigned.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">This action requires justification</span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Reason (required)</label>
              <Input
                placeholder="Why is this route being cancelled?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Justification (required)</label>
              <Textarea
                placeholder="Provide detailed justification for audit..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Go Back</Button>
            <Button 
              variant="destructive"
              onClick={handleCancel}
              disabled={!reason.trim() || !justification.trim() || cancelRoute.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Emergency Stop Dialog */}
      <Dialog open={dialogType === 'emergency_stop'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-500" />
              Add Emergency Stop
            </DialogTitle>
            <DialogDescription>
              Insert an urgent stop into this active route.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Store</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store..." />
                </SelectTrigger>
                <SelectContent>
                  {stores?.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name} - {store.address_city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Reason (required)</label>
              <Textarea
                placeholder="Why is this emergency stop needed?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button 
              onClick={handleEmergencyStop}
              disabled={!selectedStore || !reason.trim() || addEmergencyStop.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Stop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Intervention History Component
export function InterventionHistory({ routeId }: { routeId: string }) {
  const { data: interventions } = useRecentInterventions(10);
  
  const routeInterventions = interventions?.filter(i => i.route_id === routeId) || [];
  
  if (routeInterventions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No interventions recorded
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {routeInterventions.map((intervention) => (
        <div 
          key={intervention.id}
          className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg text-sm"
        >
          <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium capitalize">
              {intervention.intervention_type.replace(/_/g, ' ')}
            </p>
            <p className="text-muted-foreground">{intervention.reason}</p>
            <p className="text-xs text-muted-foreground mt-1">
              by {intervention.performer?.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
