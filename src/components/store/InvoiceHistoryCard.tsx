import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, DollarSign, Calendar, Package, Plus, Loader2, MoreVertical, Edit, Trash2, Ban, Eye, Upload, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { dynastyDate, dynastyStamp, dynastyRelative, dynastyDateWithWeekday } from '@/lib/dates';
import { toast } from 'sonner';
import { EditStoreInvoiceModal } from './EditStoreInvoiceModal';
import { BulkInvoiceUploader } from './BulkInvoiceUploader';
import { useNavigate } from 'react-router-dom';

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  payment_status: string;
  payment_method: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  brand: string | null;
  notes: string | null;
  partial_amount: number | null;
  received_by: string | null;
  delivery_photos: string[] | null;
}

interface InvoiceHistoryCardProps {
  storeId: string;
  storeName?: string;
  onCreateInvoice?: () => void;
  /** Polymorphic entity type for unified invoice system */
  entityType?: 'store' | 'wholesaler' | 'company';
  /** Polymorphic entity ID — defaults to storeId if not provided */
  entityId?: string;
}

export function InvoiceHistoryCard({ storeId, storeName = 'Store', onCreateInvoice, entityType, entityId }: InvoiceHistoryCardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Resolve entity for polymorphic queries
  const resolvedEntityType = entityType || 'store';
  const resolvedEntityId = entityId || storeId;

  const invoicesQueryKey = ['store-invoices', resolvedEntityType, resolvedEntityId];

  /** Repaint every surface that reads invoices for this entity. */
  const refreshInvoiceViews = () => {
    queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['unified-invoice-feed'] });
    queryClient.invalidateQueries({ queryKey: ['store-recent-invoices', storeId] });
    queryClient.invalidateQueries({ queryKey: ['store-recent-invoices-sku', storeId] });
    queryClient.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
    queryClient.invalidateQueries({ queryKey: ['store-tube-kpi-batch'] });
    queryClient.invalidateQueries({ queryKey: ['store-inventory-stamps'] });
  };

  const { data: invoices = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: invoicesQueryKey,
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      // Use polymorphic entity_type + entity_id if available, fallback to store_id
      if (entityType) {
        query = query.eq('entity_type', resolvedEntityType).eq('entity_id', resolvedEntityId);
      } else {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!resolvedEntityId,
  });


  const togglePaymentStatusMutation = useMutation({
    mutationFn: async ({ invoiceId, newStatus }: { invoiceId: string; newStatus: string }) => {
      const updateData: any = {
        payment_status: newStatus,
      };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Invoice status updated to ${newStatus}`);
      refreshInvoiceViews();
      setConfirmDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Hard delete via SECURITY DEFINER RPC: also clears dependent ledger /
      // payment / transaction rows that hold RESTRICT + NO ACTION foreign keys.
      const { data, error } = await (supabase as any).rpc('delete_invoice_cascade', {
        p_invoice_id: invoiceId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const extra = data?.tube_sale_ledger_deleted
        ? ` (${data.tube_sale_ledger_deleted} ledger row(s) removed)`
        : '';
      toast.success(`Invoice permanently deleted${extra}`);
      refreshInvoiceViews();
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message || error.details || 'unknown error'}`);
    },
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .update({ 
          payment_status: 'voided',
        })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invoice voided');
      refreshInvoiceViews();
      setVoidDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to void: ${error.message}`);
    },
  });


  const handleToggleStatus = (invoice: Invoice) => {
    const currentStatus = invoice.payment_status;
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    setSelectedInvoice(invoice);
    setNewStatus(nextStatus);
    setConfirmDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    if (selectedInvoice) {
      togglePaymentStatusMutation.mutate({
        invoiceId: selectedInvoice.id,
        newStatus,
      });
    }
  };

  const handleEdit = (invoice: Invoice) => {
    // Finalized invoices are handled inside the modal: it offers a
    // reason-gated reopen (reopen_invoice RPC) and re-finalizes on save.
    setInvoiceToEdit(invoice);
    setEditModalOpen(true);
  };

  const handleDelete = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDeleteDialogOpen(true);
  };

  const handleVoid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setVoidDialogOpen(true);
  };

  const handleViewDetails = (invoice: Invoice) => {
    navigate(`/billing/invoices/${invoice.id}`);
  };

  const totalPaid = invoices
    .filter(inv => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const totalUnpaid = invoices
    .filter(inv => inv.payment_status !== 'paid' && inv.payment_status !== 'voided')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const totalValue = invoices
    .filter(inv => inv.payment_status !== 'voided')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'pending':
      case 'unpaid':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      case 'partial':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'overdue':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'voided':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30 line-through';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30';
    }
  };

  // ALL invoices can be edited and deleted - no restrictions
  // This is an operations CRM, not an accounting system
  const getInvoiceActions = () => {
    return {
      canEdit: true,
      canDelete: true,
      canVoid: false, // Void removed - just use delete
      canTogglePayment: true,
    };
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Invoice History
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  refreshInvoiceViews();
                  refetch();
                }}
                size="sm"
                variant="outline"
                disabled={isFetching}
                title="Refresh invoice list"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => setBulkUploadOpen(true)}
                size="sm"
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Add
              </Button>

              {onCreateInvoice && (
                <Button
                  onClick={onCreateInvoice}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Money Tracking Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary/30 border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
              <p className="text-lg font-bold text-green-600">${totalPaid.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Unpaid</p>
              <p className="text-lg font-bold text-yellow-600">${totalUnpaid.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Value</p>
              <p className="text-lg font-bold">${totalValue.toFixed(2)}</p>
            </div>
          </div>

          {/* Invoice List */}
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invoices yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {invoices.map((invoice) => {
                const actions = getInvoiceActions();
                const amountPaid = invoice.payment_status === 'paid' 
                  ? invoice.total_amount 
                  : (invoice.partial_amount || 0);
                const balanceDue = Number(invoice.total_amount) - amountPaid;

                return (
                  <div
                    key={invoice.id}
                    className="p-4 rounded-lg bg-secondary/30 border space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{invoice.invoice_number}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(invoice.payment_status)}`}
                            onClick={() => actions.canTogglePayment && handleToggleStatus(invoice)}
                            title={actions.canTogglePayment ? `Click to mark as ${invoice.payment_status === 'paid' ? 'unpaid' : 'paid'}` : undefined}
                          >
                            {invoice.payment_status}
                          </Badge>
                        </div>
                        {invoice.brand && (
                          <p className="text-sm text-muted-foreground">{invoice.brand}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-lg font-bold">${Number(invoice.total_amount).toFixed(2)}</p>
                          {invoice.payment_status === 'partial' && (
                            <p className="text-xs text-muted-foreground">
                              Due: ${balanceDue.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(invoice)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {actions.canEdit && (
                              <DropdownMenuItem onClick={() => handleEdit(invoice)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Invoice
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {actions.canDelete && (
                              <DropdownMenuItem 
                                onClick={() => handleDelete(invoice)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Invoice
                              </DropdownMenuItem>
                            )}
                            {actions.canVoid && !actions.canDelete && (
                              <DropdownMenuItem 
                                onClick={() => handleVoid(invoice)}
                                className="text-destructive"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Void Invoice
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Issued:{' '}
                          <span className="text-foreground">
                            {invoice.created_at ? dynastyStamp(invoice.created_at) : 'N/A'}
                          </span>
                        </span>
                      </div>
                      {invoice.due_date && (
                        <div className="flex items-center gap-1">
                          <span>Due:</span>
                          <span className="text-foreground font-medium">
                            {dynastyDateWithWeekday(invoice.due_date)}
                          </span>
                          <span className="opacity-80">({dynastyRelative(invoice.due_date)})</span>
                        </div>
                      )}
                      {invoice.payment_method && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="capitalize">{invoice.payment_method}</span>
                        </div>
                      )}
                      {invoice.paid_at && (
                        <div className="flex items-center gap-1">
                          <span>Paid:</span>
                          <span>{dynastyDate(invoice.paid_at)}</span>
                        </div>
                      )}
                    </div>

                    {invoice.notes && (
                      <p className="text-xs text-muted-foreground italic pt-1 border-t">
                        {invoice.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggle Status Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Payment Status?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark invoice <strong>{selectedInvoice?.invoice_number}</strong> as <strong>{newStatus}</strong>?
              {newStatus === 'paid' && (
                <span className="block mt-2 text-green-600">
                  This will record the payment and update the totals.
                </span>
              )}
              {newStatus === 'unpaid' && (
                <span className="block mt-2 text-yellow-600">
                  This will remove the payment record and update the totals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglePaymentStatusMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggle}
              disabled={togglePaymentStatusMutation.isPending}
            >
              {togglePaymentStatusMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice <strong>{selectedInvoice?.invoice_number}</strong>?
              <span className="block mt-2 text-destructive">
                This action can only be performed on draft/unpaid invoices.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvoiceMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedInvoice && deleteInvoiceMutation.mutate(selectedInvoice.id)}
              disabled={deleteInvoiceMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvoiceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice <strong>{selectedInvoice?.invoice_number}</strong>?
              <span className="block mt-2 text-yellow-600">
                This will keep the invoice for audit purposes but mark it as voided.
                The amount will be removed from all totals.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidInvoiceMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedInvoice && voidInvoiceMutation.mutate(selectedInvoice.id)}
              disabled={voidInvoiceMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidInvoiceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Void Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Invoice Modal */}
      {invoiceToEdit && (
        <EditStoreInvoiceModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          invoice={invoiceToEdit}
          storeId={storeId}
          storeName={storeName}
          onSuccess={() => setInvoiceToEdit(null)}
        />
      )}

      {/* Bulk Invoice Upload Dialog */}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Bulk Add Invoices
            </DialogTitle>
            <DialogDescription>
              Import invoices via CSV or manual entry for {storeName}
            </DialogDescription>
          </DialogHeader>
          <BulkInvoiceUploader
            storeId={storeId}
            storeName={storeName}
            onClose={() => setBulkUploadOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
