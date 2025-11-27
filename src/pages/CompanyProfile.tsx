import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TubeMathEngine } from '@/components/company/TubeMathEngine';
import { PaymentReliabilityPanel } from '@/components/company/PaymentReliabilityPanel';
import { 
  Building2, Phone, Mail, MapPin, ArrowLeft, Users, ShoppingCart, 
  FileText, CreditCard, Package, StickyNote, Store, Truck, User, BarChart3, Star
} from 'lucide-react';
import { format } from 'date-fns';

// Company type labels
const typeLabels: Record<string, string> = {
  store: 'Store',
  wholesaler: 'Wholesaler',
  direct_customer: 'Direct Customer',
};

// Company type badge colors
const typeBadgeColors: Record<string, string> = {
  store: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  wholesaler: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  direct_customer: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  store: <Store className="h-4 w-4" />,
  wholesaler: <Truck className="h-4 w-4" />,
  direct_customer: <User className="h-4 w-4" />,
};

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch company data
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['company-contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .eq('company_id', id)
        .order('is_primary', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ['company-invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ['company-payments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_payments')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  // Fetch orders
  const { data: orders } = useQuery({
    queryKey: ['company-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!id,
  });

  if (companyLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">Company not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </Layout>
    );
  }

  // Calculate totals
  const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0) || 0;
  const paidInvoices = invoices?.filter(inv => inv.payment_status === 'paid').length || 0;
  const unpaidInvoices = invoices?.filter(inv => inv.payment_status === 'unpaid' || inv.payment_status === 'partial' || inv.payment_status === 'overdue').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <Badge className={typeBadgeColors[company.type] || 'bg-muted'}>
                  {typeIcons[company.type]}
                  <span className="ml-1">{typeLabels[company.type] || company.type}</span>
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {(company.default_city || company.neighborhood) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {company.neighborhood || company.default_city}, {company.boro || company.default_state}
                  </span>
                )}
                {company.default_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {company.default_phone}
                  </span>
                )}
                {company.default_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {company.default_email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {company.payment_reliability_tier && (
              <Badge variant="outline" className={
                company.payment_reliability_tier === 'elite' ? 'border-yellow-500 text-yellow-500' :
                company.payment_reliability_tier === 'solid' ? 'border-green-500 text-green-500' :
                company.payment_reliability_tier === 'concerning' ? 'border-orange-500 text-orange-500' :
                company.payment_reliability_tier === 'danger' ? 'border-red-500 text-red-500' :
                'border-gray-500 text-gray-500'
              }>
                <Star className="h-3 w-3 mr-1" />
                {company.payment_reliability_tier.toUpperCase()} ({company.payment_reliability_score || 50})
              </Badge>
            )}
            {company.sells_flowers && <Badge variant="secondary">🌸 Flowers</Badge>}
            {company.rpa_status === 'rpa' && <Badge variant="secondary">📻 RPA</Badge>}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{orders?.length || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Paid Invoices</p>
            <p className="text-2xl font-bold text-green-500">{paidInvoices}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
            <p className="text-2xl font-bold text-red-500">{unpaidInvoices}</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="tubes" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Tubes</span>
            </TabsTrigger>
            <TabsTrigger value="reliability" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reliability</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              <span className="hidden sm:inline">Notes</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Company Details</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p>{typeLabels[company.type] || company.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p>{company.neighborhood || company.default_city}, {company.boro || company.default_state}</p>
                  </div>
                  {company.default_billing_address && (
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Address</p>
                      <p>{company.default_billing_address}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{company.default_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{company.default_email || 'N/A'}</p>
                  </div>
                  {company.brand_focus && company.brand_focus.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Brand Focus</p>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {company.brand_focus.map((brand: string) => (
                          <Badge key={brand} variant="outline">{brand}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Contacts ({contacts?.length || 0})</h3>
              <div className="space-y-3">
                {contacts && contacts.length > 0 ? (
                  contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {contact.is_primary && <Badge variant="secondary">Primary</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">{contact.role}</p>
                      </div>
                      <div className="text-right text-sm">
                        {contact.phone && <p>{contact.phone}</p>}
                        {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No contacts found</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Orders ({orders?.length || 0})</h3>
              <div className="space-y-3">
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{(order.brand || 'Order').replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.boxes} boxes • {order.tubes_total || (order.boxes || 0) * 100} tubes
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${(Number(order.total) || Number(order.subtotal) || 0).toLocaleString()}</p>
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          {order.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No orders found</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Invoices ({invoices?.length || 0})</h3>
              <div className="space-y-3">
                {invoices && invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{invoice.invoice_number || 'Invoice'}</p>
                        <p className="text-sm text-muted-foreground capitalize">{(invoice.brand || '').replace('_', ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${(Number(invoice.total) || Number(invoice.total_amount) || 0).toLocaleString()}</p>
                        <Badge variant={
                          invoice.payment_status === 'paid' ? 'default' : 
                          invoice.payment_status === 'partial' ? 'secondary' : 'destructive'
                        }>
                          {invoice.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No invoices found</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payments ({payments?.length || 0})</h3>
              <div className="space-y-3">
                {payments && payments.length > 0 ? (
                  payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">${(Number(payment.paid_amount) || 0).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground capitalize">{payment.payment_method || 'Unknown'}</p>
                      </div>
                      <Badge variant={payment.payment_status === 'paid' ? 'default' : 'secondary'}>
                        {payment.payment_status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No payments found</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Tube Analytics Tab */}
          <TabsContent value="tubes" className="space-y-4">
            <TubeMathEngine companyId={id!} />
          </TabsContent>

          {/* Payment Reliability Tab */}
          <TabsContent value="reliability" className="space-y-4">
            <PaymentReliabilityPanel companyId={id!} />
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Notes & Tags</h3>
              <div className="space-y-4">
                {company.tags && company.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-2 flex-wrap">
                      {company.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <p className="p-4 bg-muted rounded-lg">{company.notes || 'No notes'}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}