import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Truck, CheckCircle, Loader2, ArrowUpDown, MapPin, Lock, MessageSquare } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { WholesalerFulfillment } from '@/services/wholesaler/useWholesalerFulfillments';
import { OrderMessageThread } from '@/components/marketplace/OrderMessageThread';

interface Props {
  fulfillments: WholesalerFulfillment[];
  isLoading: boolean;
  onGenerateLabel: (id: string) => Promise<void>;
  onMarkShipped: (id: string) => Promise<void>;
  isGeneratingLabel: boolean;
  isMarkingShipped: boolean;
  currentVendorId?: string | null;
}

type SortKey = 'created_at' | 'status' | 'sla';

export function FulfillmentCommandGrid({
  fulfillments,
  isLoading,
  onGenerateLabel,
  onMarkShipped,
  isGeneratingLabel,
  isMarkingShipped,
  currentVendorId,
}: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messagingOrderId, setMessagingOrderId] = useState<string | null>(null);

  const getSLAHours = (f: WholesalerFulfillment) => {
    if (f.status !== 'pending' && f.status !== 'label_generated') return Infinity;
    return differenceInHours(new Date(), new Date(f.created_at!));
  };

  const getSLAColor = (hours: number) => {
    if (hours === Infinity) return '';
    if (hours < 24) return 'text-emerald-400';
    if (hours < 48) return 'text-amber-400';
    return 'text-red-400';
  };

  const getSLABg = (hours: number) => {
    if (hours === Infinity) return '';
    if (hours < 24) return 'bg-emerald-500/10 border-emerald-500/20';
    if (hours < 48) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const statusOrder: Record<string, number> = { pending: 0, label_generated: 1, shipped: 2, completed: 3 };

  const sorted = [...fulfillments].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'sla') diff = getSLAHours(b) - getSLAHours(a);
    else if (sortBy === 'status') diff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    else diff = new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime();
    return sortDir === 'asc' ? -diff : diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const statusBadgeColor: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label_generated: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    shipped: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };

  const handleAction = async (id: string, action: 'label' | 'ship') => {
    setActiveId(id);
    try {
      if (action === 'label') await onGenerateLabel(id);
      else await onMarkShipped(id);
    } finally {
      setActiveId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Fulfillment Queue</CardTitle>
          <span className="text-xs text-muted-foreground">{fulfillments.length} total</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_80px_80px_100px_120px] gap-2 px-4 py-2 border-b border-border/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1 text-left">
            Order <ArrowUpDown className="h-3 w-3" />
          </button>
          <span>Product</span>
          <span>Qty</span>
          <button onClick={() => toggleSort('sla')} className="flex items-center gap-1">
            SLA <ArrowUpDown className="h-3 w-3" />
          </button>
          <button onClick={() => toggleSort('status')} className="flex items-center gap-1">
            Status <ArrowUpDown className="h-3 w-3" />
          </button>
          <span className="text-right">Action</span>
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No fulfillments</div>
          ) : sorted.map(f => {
            const slaHours = getSLAHours(f);
            const items = Array.isArray(f.items_snapshot) ? f.items_snapshot : [];
            const firstItem = items[0];
            const totalQty = items.reduce((s: number, it: any) => s + (it.qty || 0), 0);
            const isExpanded = expandedId === f.id;

            return (
              <div key={f.id}>
                <div
                  className="grid grid-cols-[1fr_100px_80px_80px_100px_120px] gap-2 px-4 py-2.5 border-b border-border/20 items-center hover:bg-muted/20 transition-colors text-sm cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                >
                  <div>
                    <p className="font-mono text-xs font-medium">#{f.order_id?.slice(0, 8)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {f.created_at ? format(new Date(f.created_at), 'MMM d, yyyy, h:mm a') : '—'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {firstItem?.product_name || '—'}{items.length > 1 ? ` +${items.length - 1}` : ''}
                  </p>
                  <p className="text-xs font-medium">{totalQty}</p>
                  <div>
                    {slaHours !== Infinity ? (
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${getSLABg(slaHours)} ${getSLAColor(slaHours)}`}>
                        {slaHours}h
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <Badge className={`text-[10px] h-5 ${statusBadgeColor[f.status] || ''}`}>
                    {f.status.replace('_', ' ')}
                  </Badge>
                  <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                    {f.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={activeId === f.id && isGeneratingLabel}
                        onClick={() => handleAction(f.id, 'label')}
                      >
                        {activeId === f.id && isGeneratingLabel ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                        Label
                      </Button>
                    )}
                    {f.status === 'label_generated' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={activeId === f.id && isMarkingShipped}
                        onClick={() => handleAction(f.id, 'ship')}
                      >
                        {activeId === f.id && isMarkingShipped ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                        Ship
                      </Button>
                    )}
                    {f.status === 'shipped' && (
                      <span className="text-xs text-purple-400 flex items-center gap-1"><Truck className="h-3 w-3" /> Transit</span>
                    )}
                    {f.status === 'completed' && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Done</span>
                    )}
                  </div>
                </div>

                {/* Expanded: shipping address + item details (privacy-controlled) */}
                {isExpanded && (
                  <div className="px-6 py-3 bg-muted/10 border-b border-border/20 grid grid-cols-2 gap-4 text-xs">
                    {/* Shipping destination */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Ship To
                      </p>
                      {f.ship_to ? (
                        <div className="space-y-0.5 text-foreground">
                          <p className="font-medium">{f.ship_to.name}</p>
                          <p>{f.ship_to.address1}</p>
                          {f.ship_to.address2 && <p>{f.ship_to.address2}</p>}
                          <p>{f.ship_to.city}, {f.ship_to.state} {f.ship_to.zip}</p>
                          {f.ship_to.country && f.ship_to.country !== 'US' && <p>{f.ship_to.country}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          <span>Address available after payment confirmed</span>
                        </div>
                      )}
                    </div>

                    {/* Items detail */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Items</p>
                      <div className="space-y-1">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-foreground">
                            <span className="truncate mr-2">{item.product_name || `Product ${idx + 1}`}</span>
                            <span className="font-mono font-medium whitespace-nowrap">×{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      {f.tracking_number && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                          <p className="text-[10px] text-muted-foreground">Tracking</p>
                          <p className="font-mono text-foreground">{f.tracking_number}</p>
                        </div>
                      )}
                    </div>

                    {/* Message Customer button */}
                    <div className="col-span-2 pt-2 border-t border-border/20 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMessagingOrderId(messagingOrderId === f.order_id ? null : f.order_id);
                        }}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {messagingOrderId === f.order_id ? 'Close Messages' : 'Message Customer'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inline messaging panel (outside expanded details) */}
                {messagingOrderId === f.order_id && (
                  <div className="px-4 py-3 border-b border-border/20 bg-background/30">
                    <OrderMessageThread
                      orderId={f.order_id}
                      senderRole="vendor"
                      vendorId={currentVendorId || f.wholesaler_id}
                      disputeActive={f.dispute_status != null && f.dispute_status !== 'none' && f.dispute_status !== ''}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
