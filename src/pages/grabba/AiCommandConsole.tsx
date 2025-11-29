// ═══════════════════════════════════════════════════════════════════════════════
// AI COMMAND CONSOLE PAGE — Natural Language Action Engine
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { useAiCommandEngine, AiCommandContext, AiParsedPlan } from '@/hooks/useAiCommandEngine';
import { fetchUserCommandLogs, AiCommandLog } from '@/lib/aiCommands';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { DrillDownEntity, DrillDownFilters } from '@/lib/drilldown';

const SAMPLE_COMMANDS = [
  'Create a route for unpaid stores tomorrow at 10am',
  'Schedule follow-ups for overdue invoices next week',
  'Send text reminders to inactive stores',
  'Export all low stock inventory items',
  'Create route for Brooklyn stores on Monday',
];

export default function AiCommandConsole() {
  const [searchParams] = useSearchParams();
  const { parseCommand, executePlan, isExecuting, lastError } = useAiCommandEngine();

  const [input, setInput] = useState('');
  const [commandLogs, setCommandLogs] = useState<AiCommandLog[]>([]);
  const [currentPlan, setCurrentPlan] = useState<AiParsedPlan | null>(null);
  const [context, setContext] = useState<AiCommandContext>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Parse URL params for context
  useEffect(() => {
    const entity = searchParams.get('entity') as DrillDownEntity | null;
    const status = searchParams.get('status');
    const brand = searchParams.get('brand');
    const region = searchParams.get('region');
    const title = searchParams.get('title');
    const selected = searchParams.get('selected');

    const newContext: AiCommandContext = {};
    
    if (entity) newContext.entityType = entity;
    if (brand) newContext.brand = brand;
    if (region) newContext.region = region;
    if (title) newContext.title = title;
    
    if (selected) {
      newContext.selectedIds = selected.split(',').filter(Boolean);
    }

    const filters: DrillDownFilters = {};
    if (status) filters.status = status;
    if (brand) filters.brand = brand;
    if (region) filters.region = region;
    newContext.panelFilters = filters;

    setContext(newContext);
  }, [searchParams]);

  // Load command history
  useEffect(() => {
    async function loadLogs() {
      setIsLoadingLogs(true);
      const logs = await fetchUserCommandLogs(30);
      setCommandLogs(logs);
      setIsLoadingLogs(false);
    }
    loadLogs();
  }, []);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    try {
      const plan = await parseCommand(input, context);
      setCurrentPlan(plan);

      // If requires confirmation, show dialog
      if (plan.requiresConfirmation) {
        setShowConfirmDialog(true);
      }
    } catch (err) {
      toast.error('Failed to parse command');
    }
  };

  const handleExecute = async () => {
    if (!currentPlan) return;
    setShowConfirmDialog(false);

    const result = await executePlan(currentPlan);
    
    if (result.success) {
      setInput('');
      setCurrentPlan(null);
      // Refresh logs
      const logs = await fetchUserCommandLogs(30);
      setCommandLogs(logs);
    }
  };

  const handleCancel = () => {
    setCurrentPlan(null);
    setShowConfirmDialog(false);
  };

  const handleSampleClick = (sample: string) => {
    setInput(sample);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executed':
        return <Badge variant="default" className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Executed</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Planned</Badge>;
    }
  };

  const hasContext = context.entityType || context.selectedIds?.length || context.brand;

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              AI Command Copilot
            </h1>
            <p className="text-muted-foreground mt-1">
              Type what you want done. The system will plan and execute using your data.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Powered by GrabbA Engine
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Console Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Context Banner */}
            {hasContext && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="font-medium">Context:</span>
                    {context.entityType && (
                      <Badge variant="outline">{context.entityType}</Badge>
                    )}
                    {context.selectedIds?.length && (
                      <Badge variant="secondary">{context.selectedIds.length} selected</Badge>
                    )}
                    {context.brand && (
                      <Badge variant="outline">{context.brand}</Badge>
                    )}
                    {context.panelFilters?.status && (
                      <Badge variant="outline">{context.panelFilters.status}</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContext({})}
                  >
                    Clear
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Current Plan Card */}
            {currentPlan && (
              <Card className="border-accent/50 bg-accent/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Planned Action
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{currentPlan.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Entity: {currentPlan.entityType}
                    </Badge>
                    <Badge variant="outline">
                      Action: {currentPlan.actionIntent}
                    </Badge>
                    {currentPlan.schedule?.date && (
                      <Badge variant="outline">
                        Date: {currentPlan.schedule.date}
                      </Badge>
                    )}
                    {currentPlan.schedule?.time && (
                      <Badge variant="outline">
                        Time: {currentPlan.schedule.time}
                      </Badge>
                    )}
                    {currentPlan.estimatedCount && (
                      <Badge variant="secondary">
                        ~{currentPlan.estimatedCount} items
                      </Badge>
                    )}
                  </div>

                  {currentPlan.requiresConfirmation && (
                    <div className="flex items-center gap-2 text-amber-500 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      This may affect many records. Confirmation required.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={currentPlan.requiresConfirmation ? () => setShowConfirmDialog(true) : handleExecute}
                      disabled={isExecuting}
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Execute Plan
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input Area */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command... (e.g., 'Create a route for unpaid stores tomorrow at 10am')"
                    className="min-h-[100px] resize-none"
                    disabled={isExecuting}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      Press Enter to parse • Shift+Enter for new line
                    </p>
                    <Button onClick={handleSubmit} disabled={!input.trim() || isExecuting}>
                      <Send className="w-4 h-4 mr-2" />
                      Parse Command
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Commands */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Try these commands
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {SAMPLE_COMMANDS.map((sample) => (
                  <Button
                    key={sample}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSampleClick(sample)}
                  >
                    {sample}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* History Panel */}
          <div className="space-y-4">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Command History</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  {isLoadingLogs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : commandLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bot className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>No commands yet</p>
                      <p className="text-xs">Your command history will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {commandLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg border bg-card/50 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium line-clamp-2">
                              {log.input_text}
                            </p>
                            {getStatusBadge(log.status)}
                          </div>
                          
                          {log.affected_entity_type && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {log.affected_entity_type}
                              </Badge>
                              {log.affected_entity_ids?.length && (
                                <span>{log.affected_entity_ids.length} affected</span>
                              )}
                            </div>
                          )}
                          
                          {log.error_message && (
                            <p className="text-xs text-destructive line-clamp-1">
                              {log.error_message}
                            </p>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Large Operation
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action may affect many records. Are you sure you want to proceed?
              <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                {currentPlan?.description}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute}>
              Confirm & Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GrabbaLayout>
  );
}
