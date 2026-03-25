import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Store, Search } from 'lucide-react';
import { InvoiceModeSelector, InvoiceMode } from '@/components/invoice/InvoiceModeSelector';
import { Badge } from '@/components/ui/badge';

const BillingInvoiceNew = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('live');
  const [storeSearch, setStoreSearch] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [formData, setFormData] = useState({
    customer_id: '',
    store_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: '',
    tax: '',
    status: 'draft',
    notes: '',
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-for-invoice'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_customers')
        .select('id, name, business_type')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Query stores for optional store assignment
  const { data: stores } = useQuery({
    queryKey: ['stores-for-invoice', storeSearch],
    queryFn: async () => {
      let query = supabase
        .from('store_master')
        .select('id, store_name, city, state, phone')
        .order('store_name')
        .limit(50);
      if (storeSearch) {
        query = query.ilike('store_name', `%${storeSearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const selectedStore = stores?.find(s => s.id === formData.store_id);

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const subtotal = parseFloat(formData.subtotal) || 0;
      const tax = parseFloat(formData.tax) || 0;
      const total = subtotal + tax;
      const dueDate = formData.due_date || (() => {
        const d = new Date(formData.invoice_date);
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })();

      // If store is assigned → insert into `invoices` table (unified polymorphic system)
      if (formData.store_id) {
        const { data: invoice, error } = await supabase
          .from('invoices')
          .insert({
            entity_type: 'store',
            entity_id: formData.store_id,
            store_id: formData.store_id,
            invoice_number: formData.invoice_number,
            due_date: dueDate,
            subtotal,
            tax,
            total,
            status: formData.status,
            notes: formData.notes || null,
            is_historical: invoiceMode === 'historical',
            entry_mode: invoiceMode === 'historical' ? 'backfill' : 'live',
          })
          .select('id')
          .single();

        if (error) throw error;

        // Trigger SMS receipt via edge function (for live invoices)
        if (invoiceMode === 'live') {
          const storeName = selectedStore?.store_name || 'Store';
          supabase.functions.invoke('send-invoice-receipt', {
            body: {
              invoice_id: invoice.id,
              store_id: formData.store_id,
              invoice_number: formData.invoice_number,
              total_amount: total,
              store_name: storeName,
              due_date: dueDate,
              is_historical: false,
              recipient_phone: recipientPhone || undefined,
              custom_message: customMessage || undefined,
            },
          }).catch(err => console.error('Receipt send error (non-blocking):', err));
        }

        return invoice;
      }

      // No store → insert into customer_invoices (CRM flow)
      const { data: invoice, error } = await supabase
        .from('customer_invoices')
        .insert({
          customer_id: formData.customer_id,
          invoice_number: formData.invoice_number,
          invoice_date: formData.invoice_date,
          due_date: dueDate || null,
          subtotal,
          tax,
          total_amount: total,
          status: formData.status,
          notes: formData.notes || null,
          is_historical: invoiceMode === 'historical',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Trigger SMS receipt for CRM invoices too (for live invoices)
      if (invoiceMode === 'live' && formData.customer_id) {
        const customer = customers?.find(c => c.id === formData.customer_id);
        supabase.functions.invoke('send-invoice-receipt', {
          body: {
            customer_invoice_id: invoice.id,
            customer_id: formData.customer_id,
            invoice_number: formData.invoice_number,
            total_amount: total,
            store_name: customer?.name || 'Customer',
            due_date: dueDate,
            is_historical: false,
            recipient_phone: recipientPhone || undefined,
            custom_message: customMessage || undefined,
          },
        }).catch(err => console.error('Receipt send error (non-blocking):', err));
      }

      return invoice;
    },
    onSuccess: () => {
      const modeLabel = invoiceMode === 'historical' ? ' (historical - no notifications)' : '';
      toast.success(`Invoice created successfully${modeLabel}`);
      queryClient.invalidateQueries({ queryKey: ['all-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['store-invoices'] });
      navigate('/billing/invoices');
    },
    onError: (error: any) => {
      toast.error('Failed to create invoice: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id && !formData.store_id) {
      toast.error('Please select a customer or a store');
      return;
    }
    if (!formData.invoice_number) {
      toast.error('Please enter an invoice number');
      return;
    }
    if (!formData.subtotal) {
      toast.error('Please enter a subtotal');
      return;
    }

    createInvoiceMutation.mutate();
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/billing/invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Create Invoice
            </h1>
            <p className="text-muted-foreground">Generate a new customer invoice</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Invoice Mode Selector */}
            <InvoiceModeSelector 
              mode={invoiceMode} 
              onModeChange={setInvoiceMode} 
            />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Store Selector (optional) */}
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Assign to Store (optional)
                </Label>
                {formData.store_id && selectedStore ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 py-1.5 px-3 text-sm">
                      <Store className="h-3 w-3" />
                      {selectedStore.store_name}
                      {selectedStore.city && ` — ${selectedStore.city}, ${selectedStore.state || ''}`}
                    </Badge>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormData({ ...formData, store_id: '' })}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search stores by name..."
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {stores && stores.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {stores.map(store => (
                          <div
                            key={store.id}
                            className="p-2 hover:bg-muted/50 cursor-pointer text-sm flex justify-between items-center"
                            onClick={() => {
                              setFormData({ ...formData, store_id: store.id, customer_id: '' });
                              setStoreSearch('');
                            }}
                          >
                            <span className="font-medium">{store.store_name}</span>
                            <span className="text-muted-foreground text-xs">
                              {[store.city, store.state].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  If assigned, this invoice will appear in the store's profile and an SMS receipt will be sent.
                </p>
              </div>

              {/* Customer selector — only show if no store selected */}
              {!formData.store_id && (
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => setFormData({...formData, customer_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.business_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                  placeholder="INV-2025-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({...formData, invoice_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtotal">Subtotal *</Label>
                <Input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  value={formData.subtotal}
                  onChange={(e) => setFormData({...formData, subtotal: e.target.value})}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax">Tax</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  value={formData.tax}
                  onChange={(e) => setFormData({...formData, tax: e.target.value})}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            {/* Recipient Contact (for SMS receipt) */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed bg-muted/20">
              <Label className="flex items-center gap-2 text-sm font-medium">
                📱 Send Receipt To (SMS via Twilio)
              </Label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g., +1234567890 or 2125551234"
              />
              <p className="text-xs text-muted-foreground">
                Enter a phone number to send the invoice receipt via SMS. Leave blank to auto-resolve from store/customer contacts.
              </p>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Custom Message (optional)</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal note to the invoice receipt..."
                  rows={2}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold">Total Amount:</span>
                <span className="text-2xl font-bold">
                  ${((parseFloat(formData.subtotal) || 0) + (parseFloat(formData.tax) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/billing/invoices')} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={createInvoiceMutation.isPending} className="flex-1">
                {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default BillingInvoiceNew;
