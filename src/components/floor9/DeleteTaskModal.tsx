/**
 * DeleteTaskModal - Safe task deletion with confirmation
 * Cancels remaining actions, preserves audit trail
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
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  taskStatus: string;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

const CONFIRMATION_TEXT = 'DELETE TASK';

export function DeleteTaskModal({
  open,
  onOpenChange,
  taskTitle,
  taskStatus,
  onConfirmDelete,
  isDeleting,
}: DeleteTaskModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  
  const isRunning = taskStatus === 'processing' || taskStatus === 'validating_inputs';
  const canConfirm = confirmInput === CONFIRMATION_TEXT;

  const handleClose = () => {
    setConfirmInput('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Task & Cancel Actions
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to delete: <strong>{taskTitle}</strong>
              </p>
              
              {isRunning && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Task is currently running
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Deleting will immediately stop all processing.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                <p className="font-medium">This action will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cancel all remaining queued actions</li>
                  <li>Stop any background processing immediately</li>
                  <li>Clear pending approvals</li>
                </ul>
                
                <p className="font-medium mt-3">This action will NOT:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Delete already-written records (invoices, notes, etc.)</li>
                  <li>Remove the audit trail</li>
                  <li>Modify historical data</li>
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={!canConfirm || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Task'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}