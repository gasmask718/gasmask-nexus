import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  Calendar,
  DollarSign,
  Truck,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { WholesalerOrder } from '@/hooks/useWholesalerIntelligence';

interface OrderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WholesalerOrder | null;
  onReorder?: () => void;
  onFlagIssue?: (orderId: string, note: string) => void;
  onAddNote?: (orderId: string, note: string) => void;
}

export function OrderDetailDrawer({
  open,
  onOpenChange,
  order,
  onReorder,
  onFlagIssue,
  onAddNote,
}: OrderDetailDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'shipped': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'confirmed': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'pending': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-500/20 text-green-400';
      case 'partial': return 'bg-amber-500/20 text-amber-400';
      case 'overdue': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const handleAddNote = () => {
    if (noteText.trim() && onAddNote) {
      onAddNote(order.id, noteText);
      setNoteText('');
      setShowNoteInput(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Order {order.order_number || order.id.slice(0, 8)}
          </SheetTitle>
          <SheetDescription>
            {format(new Date(order.order_date), 'MMMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(order.status)}>
              {order.status}
            </Badge>
            <Badge className={getPaymentColor(order.payment_status)}>
              {order.payment_status}
            </Badge>
            {order.days_to_payment && order.days_to_payment > 30 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                <Clock className="h-3 w-3 mr-1" />
                {order.days_to_payment} days to pay
              </Badge>
            )}
          </div>

          {/* Order Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
              <p className="text-2xl font-bold">${order.total_amount.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Items Count</p>
              <p className="text-2xl font-bold">{order.items_count}</p>
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div>
            <h4 className="text-sm font-medium mb-3">Order Items</h4>
            <div className="space-y-2">
              {(order.skus || []).map((sku: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{sku.name || sku.sku || 'Unknown Item'}</p>
                    <p className="text-xs text-muted-foreground">SKU: {sku.sku || sku.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">x{sku.quantity || 1}</p>
                    {sku.price && (
                      <p className="text-xs text-muted-foreground">${sku.price}</p>
                    )}
                  </div>
                </div>
              ))}
              {(!order.skus || order.skus.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No item details available
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Delivery Info */}
          <div>
            <h4 className="text-sm font-medium mb-3">Delivery Information</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order Date</span>
                <span className="text-sm">{format(new Date(order.order_date), 'PPP')}</span>
              </div>
              {order.delivery_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Delivery Date</span>
                  <span className="text-sm">{format(new Date(order.delivery_date), 'PPP')}</span>
                </div>
              )}
              {order.payment_received_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Received</span>
                  <span className="text-sm">{format(new Date(order.payment_received_date), 'PPP')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                  {order.notes}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onReorder} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reorder
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Add Note
              </Button>
              <Button
                variant="outline"
                onClick={() => onFlagIssue?.(order.id, 'Issue flagged')}
                className="gap-2 text-amber-400 hover:text-amber-300"
              >
                <AlertTriangle className="h-4 w-4" />
                Flag Issue
              </Button>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                View Invoice
              </Button>
            </div>

            {showNoteInput && (
              <div className="space-y-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this order..."
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowNoteInput(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddNote}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Save Note
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
