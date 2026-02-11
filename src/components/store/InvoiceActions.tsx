/**
 * InvoiceActions — Finalize / Void buttons for invoice lifecycle management
 * Used inside InvoiceDetailModal to transition invoice states.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, ShieldCheck, Ban, Loader2, FileCheck, AlertTriangle } from 'lucide-react';

interface InvoiceActionsProps {
  invoiceId: string;
  status: string | null;
  onStatusChange?: () => void;
}

export function InvoiceActions({ invoiceId, status, onStatusChange }: InvoiceActionsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('finalize_invoice', {
        p_invoice_id: invoiceId,
        p_user_id: user?.id || 'manual',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const parts = [];
      if (data?.total_tubes) parts.push(`${data.total_tubes} tubes`);
      if (data?.total_bags) parts.push(`${data.total_bags} bags`);
      toast.success(`Invoice finalized — ${parts.length ? parts.join(' + ') : '0 units'} posted to ledger`);
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onStatusChange?.();
    },
    onError: (err: any) => {
      toast.error(`Finalize failed: ${err.message}`);
    },
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidReason.trim()) throw new Error('Void reason is required');
      const { data, error } = await supabase.rpc('void_invoice', {
        p_invoice_id: invoiceId,
        p_void_reason: voidReason.trim(),
        p_user_id: user?.id || 'manual',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const parts = [];
      if (data?.reversed_tubes) parts.push(`${data.reversed_tubes} tubes`);
      if (data?.reversed_bags) parts.push(`${data.reversed_bags} bags`);
      toast.success(`Invoice voided — ${parts.length ? parts.join(' + ') : '0 units'} reversed in ledger`);
      setShowVoidDialog(false);
      setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onStatusChange?.();
    },
    onError: (err: any) => {
      toast.error(`Void failed: ${err.message}`);
    },
  });

  const getStatusBadge = () => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10"><FileCheck className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'finalized':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Finalized</Badge>;
      case 'voided':
        return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Voided</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Invoice Status</span>
        {getStatusBadge()}
      </div>

      {status === 'draft' && (
        <Button
          className="w-full"
          onClick={() => setShowFinalizeDialog(true)}
          disabled={finalizeMutation.isPending}
        >
          {finalizeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Lock className="h-4 w-4 mr-2" />
          )}
          Finalize / Post Invoice
        </Button>
      )}

      {status === 'finalized' && (
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowVoidDialog(true)}
          disabled={voidMutation.isPending}
        >
          {voidMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Ban className="h-4 w-4 mr-2" />
          )}
          Void Invoice
        </Button>
      )}

      {status === 'voided' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-destructive">This invoice has been voided. Ledger entries have been reversed.</p>
        </div>
      )}

      {/* Finalize Confirmation */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Finalize Invoice?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Lock all line items (no further edits)</li>
                <li>Recompute totals from line items</li>
                <li>Write tube/unit entries to the immutable ledger</li>
              </ul>
              <p className="font-medium text-foreground mt-2">This action cannot be undone (only voided with reversal entries).</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => finalizeMutation.mutate()}>
              Finalize Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Void Invoice?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will create reversal entries in the ledger to restore inventory. The invoice record will remain for audit purposes.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Textarea
              placeholder="Reason for voiding (required)..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => voidMutation.mutate()}
              disabled={!voidReason.trim() || voidMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending ? 'Voiding...' : 'Void Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
