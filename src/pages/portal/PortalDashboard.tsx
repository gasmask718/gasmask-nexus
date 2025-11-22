import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, FileText, Receipt, CreditCard, LogOut,
  AlertCircle, CheckCircle, Clock, DollarSign
} from 'lucide-react';

const PortalDashboard = () => {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const sessionToken = localStorage.getItem('portal_session');
    const storedCustomerId = localStorage.getItem('portal_customer_id');
    
    if (!sessionToken || !storedCustomerId) {
      navigate('/portal/login');
      return;
    }
    
    setCustomerId(storedCustomerId);
  }, [navigate]);

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: ['portal-customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Fetch customer balance
  const { data: balance } = useQuery({
    queryKey: ['portal-balance', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('customer_balance')
        .select('*')
        .eq('customer_id', customerId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!customerId,
  });

  // Fetch recent invoices
  const { data: invoices } = useQuery({
    queryKey: ['portal-invoices', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const handleLogout = () => {
    localStorage.removeItem('portal_session');
    localStorage.removeItem('portal_customer_id');
    navigate('/portal/login');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: { variant: 'default', icon: CheckCircle, text: 'Paid' },
      sent: { variant: 'secondary', icon: Clock, text: 'Pending' },
      overdue: { variant: 'destructive', icon: AlertCircle, text: 'Overdue' },
      partial: { variant: 'outline', icon: Clock, text: 'Partial' },
    };
    const config = variants[status] || variants.sent;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  if (!customerId) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">GasMask Customer Portal</h1>
              <p className="text-sm text-muted-foreground">{customer?.name}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Balance Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
              <p className="text-3xl font-bold">
                ${Number(balance?.outstanding_balance || 0).toFixed(2)}
              </p>
              {balance?.next_due_date && (
                <p className="text-sm text-muted-foreground mt-2">
                  Next payment due: {new Date(balance.next_due_date).toLocaleDateString()}
                </p>
              )}
            </div>
            <DollarSign className="h-12 w-12 text-muted-foreground" />
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/portal/invoices')}>
            <FileText className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Invoices</h3>
            <p className="text-sm text-muted-foreground">
              View all invoices and make payments
            </p>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/portal/receipts')}>
            <Receipt className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Receipts</h3>
            <p className="text-sm text-muted-foreground">
              Download payment receipts
            </p>
          </Card>

          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/portal/payments')}>
            <CreditCard className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Payment Methods</h3>
            <p className="text-sm text-muted-foreground">
              Manage your payment methods
            </p>
          </Card>
        </div>

        {/* Recent Invoices */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Invoices</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/portal/invoices')}>
              View All
            </Button>
          </div>

          <div className="space-y-3">
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/portal/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold">${Number(invoice.total_amount).toFixed(2)}</p>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No invoices found</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PortalDashboard;