// ═══════════════════════════════════════════════════════════════════════════════
// AUTONOMY GUARDRAILS PANEL — Floor 4 Phase 3.5
// Visual display of autonomy blocks and eligibility status
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  TrendingDown,
  AlertTriangle,
  Clock,
  GraduationCap,
  Zap,
} from "lucide-react";
import {
  useAllActiveBlocks,
  useAutonomyBlockActions,
  type BlockType,
} from "@/hooks/useAutonomyGuardrails";
import { formatDistanceToNow } from "date-fns";

const BLOCK_TYPE_INFO: Record<BlockType, { icon: React.ReactNode; color: string; label: string }> = {
  declining_trend: {
    icon: <TrendingDown className="h-3 w-3" />,
    color: 'text-red-500 border-red-500/20 bg-red-500/10',
    label: 'Declining Trend',
  },
  critical_exception: {
    icon: <AlertTriangle className="h-3 w-3" />,
    color: 'text-orange-500 border-orange-500/20 bg-orange-500/10',
    label: 'Critical Exception',
  },
  sla_breach: {
    icon: <Clock className="h-3 w-3" />,
    color: 'text-red-500 border-red-500/20 bg-red-500/10',
    label: 'SLA Breach',
  },
  low_reliability: {
    icon: <ShieldAlert className="h-3 w-3" />,
    color: 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10',
    label: 'Low Reliability',
  },
  insufficient_routes: {
    icon: <Clock className="h-3 w-3" />,
    color: 'text-blue-500 border-blue-500/20 bg-blue-500/10',
    label: 'Insufficient Experience',
  },
  requires_training: {
    icon: <GraduationCap className="h-3 w-3" />,
    color: 'text-purple-500 border-purple-500/20 bg-purple-500/10',
    label: 'Training Required',
  },
};

export function AutonomyGuardrailsPanel() {
  const { data: blocks, isLoading } = useAllActiveBlocks();
  const { clearBlock } = useAutonomyBlockActions();
  
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  const handleClear = async () => {
    if (!selectedBlockId) return;
    await clearBlock.mutateAsync(selectedBlockId);
    setClearDialogOpen(false);
    setSelectedBlockId(null);
  };
  
  const groupedBlocks = blocks?.reduce((acc, block) => {
    const workerId = block.worker_id;
    if (!acc[workerId]) {
      acc[workerId] = {
        worker: block.worker,
        blocks: [],
      };
    }
    acc[workerId].blocks.push(block);
    return acc;
  }, {} as Record<string, { worker: any; blocks: typeof blocks }>) || {};
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Autonomy Guardrails
          </CardTitle>
          
          {blocks && blocks.length > 0 && (
            <Badge variant="outline" className="border-red-500 text-red-500">
              <Lock className="h-3 w-3 mr-1" />
              {Object.keys(groupedBlocks).length} Workers Blocked
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading guardrails...
            </div>
          ) : Object.keys(groupedBlocks).length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">No active blocks</p>
              <p className="text-sm text-muted-foreground mt-1">
                All workers meet autonomy requirements
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedBlocks).map(([workerId, { worker, blocks: workerBlocks }]) => (
                <Card key={workerId} className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={worker?.avatar_url} />
                        <AvatarFallback>
                          {worker?.name?.charAt(0) || 'W'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{worker?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {worker?.role || 'Worker'}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-red-500 text-red-500">
                        <Lock className="h-3 w-3 mr-1" />
                        Manual Only
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {workerBlocks?.map((block) => {
                        const typeInfo = BLOCK_TYPE_INFO[block.block_type];
                        return (
                          <div
                            key={block.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Badge className={typeInfo.color}>
                                {typeInfo.icon}
                                <span className="ml-1">{typeInfo.label}</span>
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(block.blocked_at), { addSuffix: true })}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedBlockId(block.id);
                                  setClearDialogOpen(true);
                                }}
                              >
                                <Unlock className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-3">
                      {workerBlocks?.length === 1 ? '1 block' : `${workerBlocks?.length} blocks`} preventing autonomy
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      {/* Clear Block Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Autonomy Block</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to clear this block? The worker may become eligible
              for higher autonomy levels after clearing.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClear}
              disabled={clearBlock.isPending}
            >
              <Unlock className="h-4 w-4 mr-2" />
              Clear Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Compact worker autonomy status component
export function WorkerAutonomyStatus({ 
  workerId, 
  eligibility 
}: { 
  workerId: string;
  eligibility: {
    eligible: boolean;
    current_level: string;
    trust_score: number;
    reliability_score: number;
    blocks: Array<{ type: string; message: string }>;
  } | null;
}) {
  if (!eligibility) return null;
  
  const getLevelBadge = () => {
    switch (eligibility.current_level) {
      case 'auto_eligible':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <Zap className="h-3 w-3 mr-1" />
            Auto-Eligible
          </Badge>
        );
      case 'assisted':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Assisted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            Manual Only
          </Badge>
        );
    }
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Autonomy Level</span>
        {getLevelBadge()}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Trust Score</span>
          <span className="font-medium">{eligibility.trust_score}</span>
        </div>
        <Progress value={eligibility.trust_score} className="h-2" />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Reliability</span>
          <span className="font-medium">{eligibility.reliability_score}%</span>
        </div>
        <Progress value={eligibility.reliability_score} className="h-2" />
      </div>
      
      {eligibility.blocks.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-red-500 mb-2">Active Blocks:</p>
          <div className="space-y-1">
            {eligibility.blocks.map((block, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                {block.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
