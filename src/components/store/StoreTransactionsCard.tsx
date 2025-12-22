import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, ChevronRight, Calendar, ExternalLink } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface StoreTransactionsCardProps {
  storeId: string;
  storeName?: string;
}

export function StoreTransactionsCard({ storeId, storeName }: StoreTransactionsCardProps) {
  const navigate = useNavigate();

  // Fetch invoices for this store
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['store-invoices', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Fetch last order date
  const { data: lastOrder } = useQuery({
    queryKey: ['store-last-order', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Fetch payments for this store
  const { data: payments } = useQuery({
    queryKey: ['store-payments', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_payments')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Partial</Badge>;
      case 'pending':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Pending</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleInvoiceClick = (invoiceId: string) => {
    navigate(`/billing/invoices/${invoiceId}`);
  };

  const handleViewAllTransactions = () => {
    // Navigate to V5 Extraction view filtered by this store
    navigate(`/billing/invoices?store=${storeId}`);
  };

  const allTransactions = [
    ...(invoices || []).map(inv => ({
      id: inv.id,
      type: 'invoice' as const,
      amount: inv.total_amount || inv.total || 0,
      status: inv.payment_status || 'pending',
      date: inv.created_at,
      label: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
      brand: inv.brand,
    })),
    ...(payments || []).map(pay => ({
      id: pay.id,
      type: 'payment' as const,
      amount: pay.paid_amount || 0,
      status: pay.payment_status || 'recorded',
      date: pay.created_at,
      label: `Payment`,
      brand: null as string | null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Recent Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Last Order Date */}
        {lastOrder && (
          <div className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Last Order</span>
            </div>
            <span className="font-medium">
              {format(new Date(lastOrder.created_at), 'MMM d, yyyy')}
            </span>
          </div>
        )}

        {/* Transactions List */}
        {invoicesLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allTransactions.length > 0 ? (
          <div className="space-y-2">
            {allTransactions.map((tx) => (
              <div
                key={`${tx.type}-${tx.id}`}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  tx.type === 'invoice' 
                    ? 'bg-muted/50 hover:bg-muted cursor-pointer' 
                    : 'bg-green-500/5'
                }`}
                onClick={() => tx.type === 'invoice' && handleInvoiceClick(tx.id)}
              >
                <div className="flex items-center gap-2">
                  {tx.type === 'invoice' ? (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <DollarSign className="h-4 w-4 text-green-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tx.label}</span>
                      {tx.brand && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {tx.brand}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono ${tx.type === 'payment' ? 'text-green-500' : ''}`}>
                    {tx.type === 'payment' ? '+' : ''}${Number(tx.amount).toFixed(2)}
                  </span>
                  {tx.type === 'invoice' && getStatusBadge(tx.status)}
                  {tx.type === 'invoice' && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No transactions recorded
          </p>
        )}

        {/* View All Transactions CTA */}
        <Button
          variant="outline"
          className="w-full mt-2 gap-2"
          onClick={handleViewAllTransactions}
        >
          <ExternalLink className="h-4 w-4" />
          View All Transactions
        </Button>
      </CardContent>
    </Card>
  );
}
