/**
 * DeleteTaskModal - Safe task lifecycle control with confirmation
 * Supports Cancel, Soft Delete, Restart, and Permanent Delete
 * 
 * Cancel: Stops execution, preserves audit trail
 * Soft Delete: Removes from active views, preserves audit trail
 * Permanent Delete: IRREVERSIBLE - removes task and all related data
 */

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Trash2, XCircle, RefreshCw, Skull } from 'lucide-react';

export type DeleteAction = 'cancel' | 'delete' | 'restart' | 'permanent';

interface DeleteTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskStatus: string;
  onConfirmCancel?: () => void;
  onConfirmDelete?: () => void;
  onConfirmRestart?: () => void;
  onConfirmPermanentDelete?: (confirmationPhrase: string) => void;
  isCancelling?: boolean;
  isDeleting?: boolean;
  isRestarting?: boolean;
  isPermanentDeleting?: boolean;
  // Legacy support for single action
  /** @deprecated Use onConfirmCancel instead */
  onConfirmDelete_legacy?: () => void;
}

const SOFT_DELETE_CONFIRMATION = 'DELETE TASK';
const PERMANENT_DELETE_CONFIRMATION = 'PERMANENTLY DELETE TASK';

export function DeleteTaskModal({
  open,
  onOpenChange,
  taskTitle,
  taskStatus,
  onConfirmCancel,
  onConfirmDelete,
  onConfirmRestart,
  onConfirmPermanentDelete,
  isCancelling = false,
  isDeleting = false,
  isRestarting = false,
  isPermanentDeleting = false,
  onConfirmDelete_legacy,
}: DeleteTaskModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [permanentConfirmInput, setPermanentConfirmInput] = useState('');
  const [activeTab, setActiveTab] = useState<DeleteAction>('cancel');
  
  const isRunning = taskStatus === 'processing' || taskStatus === 'validating_inputs' || taskStatus === 'running';
  const isCancelledOrCompleted = taskStatus === 'cancelled' || taskStatus === 'completed' || taskStatus === 'failed';
  const canConfirmSoftDelete = confirmInput === SOFT_DELETE_CONFIRMATION;
  const canConfirmPermanentDelete = permanentConfirmInput === PERMANENT_DELETE_CONFIRMATION;
  const isProcessing = isCancelling || isDeleting || isRestarting || isPermanentDeleting;

  const handleClose = () => {
    setConfirmInput('');
    setPermanentConfirmInput('');
    setActiveTab('cancel');
    onOpenChange(false);
  };

  const handleConfirmCancel = () => {
    if (onConfirmCancel) {
      onConfirmCancel();
    } else if (onConfirmDelete_legacy) {
      // Legacy support
      onConfirmDelete_legacy();
    }
  };

  const handleConfirmDelete = () => {
    if (onConfirmDelete && canConfirmSoftDelete) {
      onConfirmDelete();
    }
  };

  const handleConfirmRestart = () => {
    if (onConfirmRestart) {
      onConfirmRestart();
    }
  };

  const handleConfirmPermanentDelete = () => {
    if (onConfirmPermanentDelete && canConfirmPermanentDelete) {
      onConfirmPermanentDelete(permanentConfirmInput);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Task Lifecycle Control
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Task: <strong>{taskTitle}</strong>
              </p>
              
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeleteAction)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="cancel" disabled={isCancelledOrCompleted}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel
                  </TabsTrigger>
                  <TabsTrigger value="delete">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Hide
                  </TabsTrigger>
                  <TabsTrigger value="restart" disabled={!isCancelledOrCompleted && !isRunning}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Restart
                  </TabsTrigger>
                  <TabsTrigger value="permanent">
                    <Skull className="h-4 w-4 mr-1" />
                    Destroy
                  </TabsTrigger>
                </TabsList>

                {/* Cancel Tab */}
                <TabsContent value="cancel" className="space-y-4 mt-4">
                  {isRunning && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Task is currently running
                          </p>
                          <p className="text-amber-700 dark:text-amber-300">
                            Cancelling will immediately stop all processing.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                    <p className="font-medium">This action will:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Stop all background processing immediately</li>
                      <li>Cancel remaining queued actions</li>
                      <li>Clear pending approvals</li>
                      <li>Set status to "cancelled"</li>
                    </ul>
                    
                    <p className="font-medium mt-3">This action will NOT:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Delete already-written records</li>
                      <li>Remove the audit trail</li>
                      <li>Remove the task from views</li>
                    </ul>
                  </div>
                </TabsContent>

                {/* Soft Delete Tab */}
                <TabsContent value="delete" className="space-y-4 mt-4">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <Trash2 className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Soft Delete (Hide)
                        </p>
                        <p className="text-amber-700 dark:text-amber-300">
                          Hides the task from active lists. Audit trail is preserved.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                    <p className="font-medium">This action will:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Mark task as deleted (soft delete)</li>
                      <li>Hide from all active task views</li>
                      <li>Cancel any running execution first</li>
                    </ul>
                    
                    <p className="font-medium mt-3">Preserved:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Audit trail (permanent)</li>
                      <li>Activity log entries</li>
                      <li>Previously written data</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-delete" className="text-sm font-medium">
                      Type <code className="px-1 py-0.5 bg-muted rounded">{SOFT_DELETE_CONFIRMATION}</code> to confirm:
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder={SOFT_DELETE_CONFIRMATION}
                      className="font-mono"
                    />
                  </div>
                </TabsContent>

                {/* Restart Tab */}
                <TabsContent value="restart" className="space-y-4 mt-4">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          Fresh Start
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          Creates a new task with the same parameters.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                    <p className="font-medium">This action will:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Create a NEW task (new ID)</li>
                      <li>Copy task type and instructions</li>
                      <li>Reset all progress counters to zero</li>
                      <li>Link to original task as "restarted from"</li>
                    </ul>
                    
                    <p className="font-medium mt-3">Original task:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Remains unchanged (not deleted)</li>
                      <li>Marked as "restarted" in activity log</li>
                    </ul>
                  </div>
                </TabsContent>

                {/* Permanent Delete Tab */}
                <TabsContent value="permanent" className="space-y-4 mt-4">
                  <div className="p-3 rounded-lg bg-destructive/20 border-2 border-destructive">
                    <div className="flex items-start gap-2">
                      <Skull className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="text-sm">
                        <p className="font-bold text-destructive">
                          ⚠️ DANGER ZONE - IRREVERSIBLE
                        </p>
                        <p className="text-destructive/80">
                          This will PERMANENTLY delete the task and ALL related data.
                          This action cannot be undone. Audit trail will be destroyed.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-destructive/10 text-sm space-y-2">
                    <p className="font-medium text-destructive">This action will DESTROY:</p>
                    <ul className="list-disc list-inside space-y-1 text-destructive/80">
                      <li>The task record itself</li>
                      <li>All activity logs for this task</li>
                      <li>All observation data</li>
                      <li>All task artifacts</li>
                    </ul>
                    
                    <p className="font-bold mt-3 text-destructive">
                      THIS CANNOT BE UNDONE. USE ONLY FOR:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Test/experimental tasks</li>
                      <li>Corrupt or invalid tasks</li>
                      <li>Tasks created by system errors</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-permanent-delete" className="text-sm font-medium text-destructive">
                      Type <code className="px-1 py-0.5 bg-destructive/20 text-destructive rounded font-bold">{PERMANENT_DELETE_CONFIRMATION}</code> to confirm:
                    </Label>
                    <Input
                      id="confirm-permanent-delete"
                      value={permanentConfirmInput}
                      onChange={(e) => setPermanentConfirmInput(e.target.value)}
                      placeholder={PERMANENT_DELETE_CONFIRMATION}
                      className="font-mono border-destructive focus:ring-destructive"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} disabled={isProcessing}>
            Close
          </AlertDialogCancel>
          
          {activeTab === 'cancel' && !isCancelledOrCompleted && (
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isProcessing}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Task'}
            </AlertDialogAction>
          )}
          
          {activeTab === 'delete' && (
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={!canConfirmSoftDelete || isProcessing}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isDeleting ? 'Hiding...' : 'Hide Task'}
            </AlertDialogAction>
          )}
          
          {activeTab === 'restart' && (
            <AlertDialogAction
              onClick={handleConfirmRestart}
              disabled={isProcessing}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {isRestarting ? 'Restarting...' : 'Restart Task'}
            </AlertDialogAction>
          )}
          
          {activeTab === 'permanent' && (
            <AlertDialogAction
              onClick={handleConfirmPermanentDelete}
              disabled={!canConfirmPermanentDelete || isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPermanentDeleting ? 'Destroying...' : '🔥 Permanently Delete'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
