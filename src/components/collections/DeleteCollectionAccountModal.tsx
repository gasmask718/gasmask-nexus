/**
 * DeleteCollectionAccountModal — GDS-governed deletion for collection accounts.
 * Owner-only. Soft deletes with full snapshot to recovery ledger.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';

const DELETE_REASONS = [
  'Duplicate record',
  'Account settled / closed',
  'Data entry error',
  'Merged with another account',
  'Entity no longer active',
  'Other',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  onDeleted?: () => void;
}

export function DeleteCollectionAccountModal({ open, onOpenChange, accountId, accountName, onDeleted }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resetState = () => {
    setPassword('');
    setReason('');
    setNotes('');
    setPasswordVerified(false);
    setVerifying(false);
    setDeleting(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const verifyPassword = async () => {
    if (!user?.email || !password) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (error) {
        toast.error('Incorrect password');
      } else {
        setPasswordVerified(true);
        toast.success('Identity verified');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!passwordVerified || !reason) return;
    setDeleting(true);
    const fullReason = notes ? `${reason}: ${notes}` : reason;

    try {
      const { error } = await supabase.rpc('soft_delete_collection_account', {
        p_account_id: accountId,
        p_reason: fullReason,
        p_source_ui: 'unpaid_accounts',
      });
      if (error) throw error;

      toast.success(`"${accountName}" has been deleted. It can be recovered from Security & Governance.`);
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-debt-overview'] });
      handleClose();
      onDeleted?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const canConfirm = passwordVerified && reason.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Collection Account
          </DialogTitle>
          <DialogDescription>
            You are about to delete <strong>"{accountName}"</strong>. This action is logged
            and recoverable by the owner from Security &amp; Governance → Deleted Records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Password re-authentication */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4" />
              Step 1: Verify your identity
            </Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={passwordVerified}
                onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
              />
              <Button
                size="sm"
                variant={passwordVerified ? 'default' : 'outline'}
                onClick={verifyPassword}
                disabled={!password || passwordVerified || verifying}
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : passwordVerified ? '✓ Verified' : 'Verify'}
              </Button>
            </div>
          </div>

          {/* Step 2: Reason */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Step 2: Reason for deletion</Label>
            <Select value={reason} onValueChange={setReason} disabled={!passwordVerified}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {DELETE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!passwordVerified}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canConfirm || deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Confirm Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
