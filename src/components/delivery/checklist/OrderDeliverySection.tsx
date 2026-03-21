import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, User, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistSection } from './ChecklistSection';
import { getTasksByCategory } from '@/hooks/useDeliveryChecklist';
import { getBrandIdentity, normalizeBrandId } from '@/config/brands';
import { CreateStoreInvoiceModal } from '@/components/store/CreateStoreInvoiceModal';

interface OrderDeliverySectionProps {
  storeId: string;
  personType?: string;
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  progress: { done: number; total: number };
  orderData: Record<string, any>;
  onOrderUpdate: (data: Record<string, any>) => void;
}

interface PendingOrder {
  id: string;
  invoice_number: string;
  brand: string;
  total_amount: number;
  created_at: string;
}

export function OrderDeliverySection({
  storeId,
  personType = 'drivers',
  isTaskCompleted,
  onToggleTask,
  progress,
  orderData,
  onOrderUpdate,
}: OrderDeliverySectionProps) {
  const tasks = getTasksByCategory('orders');
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [recipientName, setRecipientName] = useState(orderData.recipientName || '');
  const [loading, setLoading] = useState(true);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');

  // Fetch store name for the modal
  useEffect(() => {
    async function fetchStoreName() {
      const { data } = await supabase
        .from('store_master')
        .select('store_name')
        .eq('id', storeId)
        .single();
      if (data?.store_name) setStoreName(data.store_name);
    }
    if (storeId) fetchStoreName();
  }, [storeId]);

  useEffect(() => {
    async function fetchPendingOrders() {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, brand, total_amount, created_at')
        .eq('store_id', storeId)
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false })
        .limit(10);
      setOrders(data || []);
      setLoading(false);
    }
    fetchPendingOrders();
  }, [storeId]);

  const handleRecipientChange = (value: string) => {
    setRecipientName(value);
    onOrderUpdate({ ...orderData, recipientName: value });
  };

  const handleInvoiceSuccess = (invoiceId: string) => {
    // Refresh pending orders after new invoice created
    supabase
      .from('invoices')
      .select('id, invoice_number, brand, total_amount, created_at')
      .eq('store_id', storeId)
      .in('payment_status', ['unpaid', 'partial'])
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setOrders(data || []));
  };

  return (
    <>
      <ChecklistSection
        title={`Orders to Deliver ${orders.length > 0 ? `(${orders.length})` : ''}`}
        icon={<Package className="h-5 w-5" />}
        category="orders"
        tasks={tasks}
        progress={progress}
        isTaskCompleted={isTaskCompleted}
        onToggleTask={onToggleTask}
        accentColor="text-blue-500"
      >
        {loading ? (
          <div className="animate-pulse h-12 bg-muted rounded" />
        ) : (
          <div className="space-y-3">
            {/* Existing pending orders */}
            {orders.length > 0 && orders.map((order) => {
              const brandId = normalizeBrandId(order.brand);
              const brand = brandId ? getBrandIdentity(brandId) : null;
              return (
                <div key={order.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    {brand && <span className="text-sm">{brand.icon}</span>}
                    <div>
                      <p className="text-sm font-medium">{order.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{brand?.displayName || order.brand}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">${(order.total_amount ?? 0).toFixed(2)}</Badge>
                </div>
              );
            })}

            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No pending orders for this store</p>
            )}

            {/* Recipient */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Received by (name & role)"
                value={recipientName}
                onChange={(e) => handleRecipientChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Create Invoice — opens the same modal used in Store Profile */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setInvoiceModalOpen(true)}
            >
              <FileText className="h-3 w-3" />
              Create Invoice
            </Button>
          </div>
        )}
      </ChecklistSection>

      {/* Reuse the exact same invoice modal from Store Profile */}
      <CreateStoreInvoiceModal
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
        storeId={storeId}
        storeName={storeName || 'Store'}
        onSuccess={handleInvoiceSuccess}
      />
    </>
  );
}
