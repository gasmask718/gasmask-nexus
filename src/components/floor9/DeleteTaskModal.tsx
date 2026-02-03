/**
 * DeleteTaskModal - Safe task deletion with confirmation
 * Supports both Cancel (stop execution) and Delete (soft delete)
 * 
 * Cancel: Stops execution, preserves audit trail
 * Delete: Removes from active views, preserves audit trail
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
import { AlertTriangle, Trash2, XCircle, RefreshCw } from 'lucide-react';

export type DeleteAction = 'cancel' | 'delete' | 'restart';

interface DeleteTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskStatus: string;
  onConfirmCancel?: () => void;
  onConfirmDelete?: () => void;
  onConfirmRestart?: () => void;
  isCancelling?: boolean;
  isDeleting?: boolean;
  isRestarting?: boolean;
  // Legacy support for single action
  /** @deprecated Use onConfirmCancel instead */
  onConfirmDelete_legacy?: () => void;
}

const CONFIRMATION_TEXT = 'DELETE TASK';

export function DeleteTaskModal({
  open,
  onOpenChange,
  taskTitle,
  taskStatus,
  onConfirmCancel,
  onConfirmDelete,
  onConfirmRestart,
  isCancelling = false,
  isDeleting = false,
  isRestarting = false,
  onConfirmDelete_legacy,
}: DeleteTaskModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [activeTab, setActiveTab] = useState<DeleteAction>('cancel');
  
  const isRunning = taskStatus === 'processing' || taskStatus === 'validating_inputs' || taskStatus === 'running';
  const isCancelledOrCompleted = taskStatus === 'cancelled' || taskStatus === 'completed' || taskStatus === 'failed';
  const canConfirmDelete = confirmInput === CONFIRMATION_TEXT;
  const isProcessing = isCancelling || isDeleting || isRestarting;

  const handleClose = () => {
    setConfirmInput('');
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
    if (onConfirmDelete && canConfirmDelete) {
      onConfirmDelete();
    }
  };

  const handleConfirmRestart = () => {
    if (onConfirmRestart) {
      onConfirmRestart();
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
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="cancel" disabled={isCancelledOrCompleted}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel
                  </TabsTrigger>
                  <TabsTrigger value="delete">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </TabsTrigger>
                  <TabsTrigger value="restart" disabled={!isCancelledOrCompleted && !isRunning}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Restart
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

                {/* Delete Tab */}
                <TabsContent value="delete" className="space-y-4 mt-4">
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-destructive">
                          Danger Zone
                        </p>
                        <p className="text-muted-foreground">
                          This soft-deletes the task. It will no longer appear in active task lists.
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
                      Type <code className="px-1 py-0.5 bg-muted rounded">{CONFIRMATION_TEXT}</code> to confirm:
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder={CONFIRMATION_TEXT}
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
              </Tabs>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} disabled={isProcessing}>
            Cancel
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
              disabled={!canConfirmDelete || isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Task'}
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
