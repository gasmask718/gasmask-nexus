import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Clock, ShieldCheck, Store, User, Phone, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Promotion {
  id: string;
  proposed_store_name: string;
  proposed_contact_name: string | null;
  proposed_phone: string | null;
  verified_sells_tobacco: boolean | null;
  verified_sells_grabba: boolean | null;
  verification_method: string;
  requested_by: string;
  requested_at: string;
  status: string;
  territory_address_id: string;
  candidate_id: string | null;
}

interface ExecutionProof {
  task_id: string;
  task_type: string;
  completed_at: string | null;
  outcome_summary: string | null;
  actor_type: string | null;
  completion_notes: string | null;
}

export default function PromotionsPending() {
  const queryClient = useQueryClient();
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [proofDialogPromotion, setProofDialogPromotion] = useState<Promotion | null>(null);

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['territory-promotions-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territory_store_promotions')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data as Promotion[];
    },
  });

  const { data: executionProof } = useQuery({
    queryKey: ['territory-execution-proof', proofDialogPromotion?.territory_address_id],
    queryFn: async () => {
      if (!proofDialogPromotion?.territory_address_id) return [];
      const { data, error } = await supabase
        .from('v_territory_execution_proof' as any)
        .select('*')
        .eq('address_id', proofDialogPromotion.territory_address_id)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ExecutionProof[];
    },
    enabled: !!proofDialogPromotion?.territory_address_id,
  });

  const approveMutation = useMutation({
    mutationFn: async (promotionId: string) => {
      const { data, error } = await supabase.rpc('approve_store_promotion', {
        p_promotion_id: promotionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Promotion Approved', description: 'Store has been promoted to CRM.' });
      queryClient.invalidateQueries({ queryKey: ['territory-promotions-pending'] });
      setSelectedPromotion(null);
    },
    onError: (err: any) => {
      toast({ title: 'Approval Failed', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reject_store_promotion', {
        p_promotion_id: id,
        p_rejection_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Promotion Rejected', description: 'Request has been rejected with reason.' });
      queryClient.invalidateQueries({ queryKey: ['territory-promotions-pending'] });
      setRejectingId(null);
      setRejectionReason('');
    },
    onError: (err: any) => {
      toast({ title: 'Rejection Failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pending Promotions</h1>
        <p className="text-muted-foreground">Review and approve store promotion requests before they enter CRM.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{promotions?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Awaiting Review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-500" />
            Promotion Requests
          </CardTitle>
          <CardDescription>Each request must be individually reviewed. No bulk actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : !promotions?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No pending promotions. All clear.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{promo.proposed_store_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {promo.proposed_contact_name && (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3 w-3" />
                            <span>{promo.proposed_contact_name}</span>
                          </div>
                        )}
                        {promo.proposed_phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{promo.proposed_phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {promo.verification_method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {promo.verified_sells_tobacco && (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Tobacco</Badge>
                        )}
                        {promo.verified_sells_grabba && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Grabba</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(promo.requested_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProofDialogPromotion(promo)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Proof
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setSelectedPromotion(promo)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectingId(promo.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Confirmation Dialog */}
      <Dialog open={!!selectedPromotion} onOpenChange={() => setSelectedPromotion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Store Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 text-sm">
            <p className="text-foreground">
              You are about to promote <strong>{selectedPromotion?.proposed_store_name}</strong> into the CRM.
            </p>
            <p className="text-muted-foreground">
              This action is irreversible. The store will appear in routes, orders, and all operational systems.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPromotion(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => selectedPromotion && approveMutation.mutate(selectedPromotion.id)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving…' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => { setRejectingId(null); setRejectionReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Provide a clear reason for rejection. This is mandatory.</p>
            <Textarea
              placeholder="Rejection reason (required)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectionReason(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectingId && rejectMutation.mutate({ id: rejectingId, reason: rejectionReason })}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Proof Dialog */}
      <Dialog open={!!proofDialogPromotion} onOpenChange={() => setProofDialogPromotion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Execution Proof — {proofDialogPromotion?.proposed_store_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!executionProof?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No execution proof found for this address.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {executionProof.map((proof: ExecutionProof, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{proof.task_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {proof.completed_at ? format(new Date(proof.completed_at), 'MMM d, yyyy h:mm a') : '—'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{proof.outcome_summary || 'No outcome recorded'}</p>
                    {proof.completion_notes && (
                      <p className="text-xs text-muted-foreground italic">"{proof.completion_notes}"</p>
                    )}
                    <p className="text-xs text-muted-foreground">Actor: {proof.actor_type || 'unknown'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
