/**
 * StaffPaymentsTab
 * 
 * SYSTEM LAW: Tabs are views into data, not decorations.
 * This is the payment ledger for the staff member.
 * No fake totals. No demo values.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, Calendar, FileText, Download, Plus,
  CheckCircle, Clock, AlertCircle, XCircle, Loader2, CreditCard
} from "lucide-react";
import { useStaffPayments, UTStaffPayment, exportPaymentsToCSV } from '@/hooks/useUnforgettableStaffTabs';
import { format, parseISO } from 'date-fns';
import AddPaymentModal from './AddPaymentModal';

interface StaffPaymentsTabProps {
  staffId: string;
  staffName?: string;
  payRate?: number | null;
  payType?: string | null;
}

export default function StaffPaymentsTab({ staffId, staffName, payRate, payType }: StaffPaymentsTabProps) {
  const { data: payments, isLoading, error } = useStaffPayments(staffId);
  const [showAddModal, setShowAddModal] = useState(false);

  const getStatusBadge = (status: UTStaffPayment['status']) => {
    const config: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
      pending: { class: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
      processing: { class: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Processing' },
      paid: { class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle className="h-3 w-3" />, label: 'Paid' },
      failed: { class: 'bg-red-500/10 text-red-600 border-red-500/20', icon: <XCircle className="h-3 w-3" />, label: 'Failed' },
      cancelled: { class: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: <AlertCircle className="h-3 w-3" />, label: 'Cancelled' },
    };
    const { class: className, icon, label } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${className} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const getPaymentTypeBadge = (type: UTStaffPayment['payment_type']) => {
    const config: Record<string, string> = {
      event: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
      bonus: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      advance: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      reimbursement: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      adjustment: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      other: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    };
    return (
      <Badge variant="outline" className={config[type] || config.other}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: UTStaffPayment['payment_method']) => {
    const labels: Record<string, string> = {
      cash: 'Cash', check: 'Check', direct_deposit: 'Direct Deposit',
      venmo: 'Venmo', zelle: 'Zelle', paypal: 'PayPal', other: 'Other',
    };
    return labels[method || 'other'] || method || 'N/A';
  };

  const handleExportCSV = () => {
    if (payments && payments.length > 0) {
      exportPaymentsToCSV(payments, staffName || 'Staff');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />Payment History</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><Skeleton className="h-20 rounded-lg" /><Skeleton className="h-20 rounded-lg" /></div>
          {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-16 rounded-lg" />))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (<Card className="border-border/50"><CardContent className="py-8 text-center"><AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Failed to load payments</p></CardContent></Card>);
  }

  const paidPayments = payments?.filter(p => p.status === 'paid') || [];
  const pendingPayments = payments?.filter(p => p.status === 'pending' || p.status === 'processing') || [];
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Total Paid</span></div><p className="text-2xl font-bold text-emerald-600">${totalPaid.toLocaleString()}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Pending</span></div><p className="text-2xl font-bold text-amber-600">${totalPending.toLocaleString()}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Pay Rate</span></div><p className="text-2xl font-bold text-blue-600">{payRate ? `$${payRate}` : '-'}<span className="text-sm font-normal text-muted-foreground">/{payType === 'hourly' ? 'hr' : 'event'}</span></p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-pink-500" /><span className="text-xs text-muted-foreground">Transactions</span></div><p className="text-2xl font-bold">{payments?.length || 0}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4 mr-2" />Add Payment</Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!payments || payments.length === 0}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-pink-500" />Payment History</CardTitle></CardHeader>
        <CardContent>
          {!payments || payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium mb-1">No payments yet</p>
              <p className="text-sm">Payment records will appear here after events.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddModal(true)}><Plus className="h-4 w-4 mr-2" />Add First Payment</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="font-medium">${payment.amount.toLocaleString()}</span>{getPaymentTypeBadge(payment.payment_type)}</div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(payment.payment_date), 'MMM d, yyyy')}</span>
                      <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                      {payment.event && (<span className="truncate">{payment.event.event_name}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">{getStatusBadge(payment.status)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <AddPaymentModal open={showAddModal} onOpenChange={setShowAddModal} staffId={staffId} />
    </div>
  );
}
