import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BillingTabProps {
  storeId: string;
  billTo: 'bill' | 'pay_upfront';
  onBillToChange: (value: 'bill' | 'pay_upfront') => void;
}

interface Invoice {
  id: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  brand?: string;
}

export function BillingTab({ storeId, billTo, onBillToChange }: BillingTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastOrderDate, setLastOrderDate] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBillingData() {
      try {
        // Fetch invoices for this store
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, created_at, total_amount, amount_paid, payment_status, brand')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (invoicesData) {
          setInvoices(invoicesData.map(inv => ({
            id: inv.id,
            invoice_date: inv.created_at,
            total_amount: inv.total_amount || 0,
            paid_amount: inv.amount_paid || 0,
            status: inv.payment_status || 'pending',
            brand: inv.brand,
          })));
          if (invoicesData.length > 0) {
            setLastOrderDate(invoicesData[0].created_at);
          }
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBillingData();
  }, [storeId]);

  const unpaidTotal = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + (i.total_amount - (i.paid_amount || 0)), 0);

  const paidTotal = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total_amount, 0);

  return (
    <div className="space-y-4">
      {/* Bill To Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing Method
          </CardTitle>
          <CardDescription>How does this store prefer to pay?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={billTo}
            onValueChange={(value) => onBillToChange(value as 'bill' | 'pay_upfront')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bill" id="bill" />
              <Label htmlFor="bill">Bill (Net Terms)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pay_upfront" id="pay_upfront" />
              <Label htmlFor="pay_upfront">Pay Upfront</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Billing Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last Order Date
            </CardDescription>
            <CardTitle className="text-xl">
              {lastOrderDate 
                ? new Date(lastOrderDate).toLocaleDateString() 
                : 'No orders'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid Total (All Time)</CardDescription>
            <CardTitle className="text-xl text-green-600">
              ${paidTotal.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={unpaidTotal > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              {unpaidTotal > 0 && <AlertCircle className="h-3 w-3 text-destructive" />}
              Outstanding Balance
            </CardDescription>
            <CardTitle className={`text-xl ${unpaidTotal > 0 ? 'text-destructive' : ''}`}>
              ${unpaidTotal.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Invoices Table (Read-Only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Invoices</CardTitle>
          <CardDescription>View only - cannot be modified during visit</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No invoices found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                    <TableCell>{invoice.brand || '-'}</TableCell>
                    <TableCell>${invoice.total_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'destructive'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
