import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DollarSign, FileText, Receipt, AlertTriangle,
  TrendingUp, Users, Sparkles, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BillingCenter = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          crm_customers(name, email, business_type)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Fetch balances
  const { data: balances } = useQuery({
    queryKey: ['billing-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_balance')
        .select(`
          *,
          crm_customers(name, email)
        `);
      if (error) throw error;
      return data;
    },
  });

  // Run AI financial analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-financial-analysis');
      if (error) throw error;
      
      toast.success(
        `Analysis complete: ${data.overdueAccounts?.length || 0} overdue, ${data.atRiskCustomers?.length || 0} at-risk`
      );
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
    } catch (error: any) {
      toast.error('Analysis failed: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalOutstanding = balances?.reduce((sum, b) => sum + Number(b.outstanding_balance || 0), 0) || 0;
  const overdueCount = invoices?.filter(i => 
    i.status === 'overdue' || 
    (i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date())
  ).length || 0;
  const paidCount = invoices?.filter(i => i.status === 'paid').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              Billing Command Center
            </h1>
            <p className="text-muted-foreground">
              Manage invoices, payments, and customer billing
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={runAnalysis}
              disabled={isAnalyzing}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
            </Button>
            <Button onClick={() => navigate('/billing/invoices/new')}>
              <FileText className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Outstanding</p>
            </div>
            <p className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <p className="text-2xl font-bold">{overdueCount}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Paid</p>
            </div>
            <p className="text-2xl font-bold">{paidCount}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Customers</p>
            </div>
            <p className="text-2xl font-bold">{balances?.length || 0}</p>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Invoices</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/billing/invoices')}>
              View All
            </Button>
          </div>

          <div className="space-y-3">
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.crm_customers?.name || 'Unknown Customer'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">${Number(invoice.total_amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No invoices found</p>
            )}
          </div>
        </Card>

        {/* At-Risk Customers */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            At-Risk Customers
          </h2>

          <div className="space-y-3">
            {balances?.filter(b => Number(b.outstanding_balance || 0) > 0).slice(0, 5).map((balance) => (
              <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{balance.crm_customers?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">
                    Last payment: {balance.last_payment_date ? new Date(balance.last_payment_date).toLocaleDateString() : 'Never'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">${Number(balance.outstanding_balance).toFixed(2)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/crm/customers/${balance.customer_id}`)}
                  >
                    View Customer
                  </Button>
                </div>
              </div>
            )) || <p className="text-center text-muted-foreground py-8">No at-risk customers</p>}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default BillingCenter;