import React, { useState } from 'react';
import { EnhancedPortalLayout, CommandCenterKPI } from '@/components/portal';
import { useWholesalerFulfillments } from '@/services/wholesaler/useWholesalerFulfillments';
import { useWholesalerPayouts } from '@/services/wholesaler/useWholesalerPayouts';
import { useWholesalerProfile } from '@/services/wholesaler/useWholesalerProfile';
import {
  Warehouse, Package, Truck, DollarSign, Tag, Printer,
  CheckCircle, Clock, ArrowRight, ExternalLink, Loader2,
  FileText, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

type FulfillmentTab = 'pending' | 'label_generated' | 'shipped' | 'completed';

export default function WholesalerPortalPage() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const { fulfillments, isLoading: fulfillmentsLoading, counts, generateLabel, isGeneratingLabel, markShipped, isMarkingShipped } = useWholesalerFulfillments();
  const { payouts, financialSummary, isLoading: payoutsLoading } = useWholesalerPayouts();
  const [activeTab, setActiveTab] = useState<FulfillmentTab>('pending');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  const isLoading = profileLoading || fulfillmentsLoading || payoutsLoading;

  const handleGenerateLabel = async (fulfillmentId: string) => {
    setGeneratingId(fulfillmentId);
    try {
      await generateLabel(fulfillmentId);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleMarkShipped = async (fulfillmentId: string) => {
    setShippingId(fulfillmentId);
    try {
      await markShipped(fulfillmentId);
    } finally {
      setShippingId(null);
    }
  };

  const filteredFulfillments = fulfillments.filter(f => f.status === activeTab);

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      label_generated: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      shipped: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  const kpis = [
    { key: 'pending', label: 'Pending', value: counts.pending.toString(), variant: 'amber' as const },
    { key: 'label_generated', label: 'Labels Ready', value: counts.label_generated.toString(), variant: 'cyan' as const },
    { key: 'shipped', label: 'Shipped', value: counts.shipped.toString(), variant: 'purple' as const },
    { key: 'completed', label: 'Completed', value: counts.completed.toString(), variant: 'green' as const },
  ];

  return (
    <EnhancedPortalLayout
      title="Wholesaler Fulfillment"
      subtitle="Manage orders, generate labels, ship packages"
      portalIcon={<Warehouse className="h-4 w-4 text-primary-foreground" />}
      quickActions={[]}
    >
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            isActive={activeTab === kpi.key}
            onClick={() => setActiveTab(kpi.key as FulfillmentTab)}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main: Fulfillment List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FulfillmentTab)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="pending" className="text-xs">
                <Clock className="h-3.5 w-3.5 mr-1" /> Pending
                {counts.pending > 0 && <Badge className="ml-1 h-4 px-1 text-[10px] bg-amber-500/15 text-amber-400">{counts.pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="label_generated" className="text-xs">
                <Tag className="h-3.5 w-3.5 mr-1" /> Labels
              </TabsTrigger>
              <TabsTrigger value="shipped" className="text-xs">
                <Truck className="h-3.5 w-3.5 mr-1" /> Shipped
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Done
              </TabsTrigger>
            </TabsList>

            {['pending', 'label_generated', 'shipped', 'completed'].map(tab => (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredFulfillments.length === 0 ? (
                  <Card className="bg-card/50 border-border/50">
                    <CardContent className="py-12 text-center">
                      <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No {tab.replace('_', ' ')} fulfillments</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredFulfillments.map(f => (
                    <FulfillmentCard
                      key={f.id}
                      fulfillment={f}
                      statusColor={getStatusColor(f.status)}
                      onGenerateLabel={() => handleGenerateLabel(f.id)}
                      onMarkShipped={() => handleMarkShipped(f.id)}
                      isGenerating={generatingId === f.id && isGeneratingLabel}
                      isShipping={shippingId === f.id && isMarkingShipped}
                    />
                  ))
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Sidebar: Payout Summary */}
        <div className="space-y-4">
          <PayoutSummaryPanel
            summary={financialSummary}
            payouts={payouts}
            isLoading={payoutsLoading}
            commissionPercent={profile?.commission_percent}
          />
        </div>
      </div>
    </EnhancedPortalLayout>
  );
}

/* ─── Fulfillment Card ─── */
function FulfillmentCard({
  fulfillment,
  statusColor,
  onGenerateLabel,
  onMarkShipped,
  isGenerating,
  isShipping,
}: {
  fulfillment: any;
  statusColor: string;
  onGenerateLabel: () => void;
  onMarkShipped: () => void;
  isGenerating: boolean;
  isShipping: boolean;
}) {
  const order = fulfillment.order;
  const items = fulfillment.items_snapshot;

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm">Fulfillment #{fulfillment.id.slice(0, 8)}</p>
              <Badge className={`text-xs ${statusColor}`}>
                {fulfillment.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Order #{order?.id?.slice(0, 8)} • {fulfillment.created_at ? format(new Date(fulfillment.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}
            </p>
          </div>
          <p className="font-bold text-lg">
            ${(order?.subtotal || 0).toFixed(2)}
          </p>
        </div>

        {/* Items snapshot */}
        {items && Array.isArray(items) && items.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 mb-3 space-y-1">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product_name || `Product ${item.product_id?.slice(0, 8)}`}
                </span>
                <span className="font-medium">
                  {item.qty}× ${(item.price_each || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tracking info */}
        {fulfillment.tracking_number && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{fulfillment.carrier}:</span>
            <span className="font-mono font-medium">{fulfillment.tracking_number}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {fulfillment.status === 'pending' && (
            <Button
              size="sm"
              onClick={onGenerateLabel}
              disabled={isGenerating}
              className="gap-1"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Generate Label
            </Button>
          )}

          {fulfillment.status === 'label_generated' && (
            <>
              {fulfillment.shipping_label_url && (
                <Button size="sm" variant="outline" asChild className="gap-1">
                  <a href={fulfillment.shipping_label_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3.5 w-3.5" /> View Label
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                onClick={onMarkShipped}
                disabled={isShipping}
                className="gap-1"
              >
                {isShipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                Mark Shipped
              </Button>
            </>
          )}

          {fulfillment.status === 'shipped' && (
            <div className="flex items-center gap-1 text-sm text-purple-400">
              <Truck className="h-4 w-4" />
              In Transit
            </div>
          )}

          {fulfillment.status === 'completed' && (
            <div className="flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Delivered
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Payout Summary Panel ─── */
function PayoutSummaryPanel({
  summary,
  payouts,
  isLoading,
  commissionPercent,
}: {
  summary: any;
  payouts: any[];
  isLoading: boolean;
  commissionPercent?: number;
}) {
  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const inSettlementPayouts = payouts?.filter(p => p.status === 'in_settlement') || [];

  const getCountdown = (releaseAt: string | null) => {
    if (!releaseAt) return null;
    const diff = new Date(releaseAt).getTime() - Date.now();
    if (diff <= 0) return 'Releasing soon...';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  const getPayoutStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'Pending Shipment',
      approved_pending_delivery: 'Shipped • Awaiting Delivery',
      in_settlement: 'In Settlement',
      approved: 'Approved for Payout',
      paid: 'Paid',
      held: 'On Hold',
      reversed: 'Reversed',
    };
    return map[status] || status;
  };

  const getPayoutStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-amber-400 border-amber-500/30',
      approved_pending_delivery: 'text-purple-400 border-purple-500/30',
      in_settlement: 'text-cyan-400 border-cyan-500/30',
      approved: 'text-blue-400 border-blue-500/30',
      paid: 'text-emerald-400 border-emerald-500/30',
      held: 'text-red-400 border-red-500/30',
      reversed: 'text-zinc-400 border-zinc-500/30',
    };
    return map[status] || 'text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            Payout Summary
          </CardTitle>
          {commissionPercent && (
            <CardDescription className="text-xs">
              Platform commission: {commissionPercent}%
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-xs text-muted-foreground">Pending Shipment</p>
              <p className="text-lg font-bold text-amber-400">
                ${(summary?.pendingPayout || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.pendingCount || 0} payouts</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <p className="text-xs text-muted-foreground">Awaiting Delivery</p>
              <p className="text-lg font-bold text-purple-400">
                ${(summary?.approvedPendingDeliveryPayout || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.approvedPendingDeliveryCount || 0} payouts</p>
            </div>
            <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <p className="text-xs text-muted-foreground">In Settlement</p>
              <p className="text-lg font-bold text-cyan-400">
                ${(summary?.inSettlementPayout || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.inSettlementCount || 0} payouts</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-xs text-muted-foreground">Ready to Pay</p>
              <p className="text-lg font-bold text-blue-400">
                ${(summary?.approvedPayout || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.approvedCount || 0} payouts</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <p className="text-xs text-muted-foreground">Paid Out</p>
              <p className="text-lg font-bold text-emerald-400">
                ${(summary?.paidPayout || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.paidCount || 0} payouts</p>
            </div>
            {(summary?.heldCount || 0) > 0 && (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-400" /> Under Dispute
                </p>
                <p className="text-lg font-bold text-red-400">
                  ${(summary?.heldPayout || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{summary?.heldCount || 0} payouts</p>
              </div>
            )}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">Total Earnings</p>
              <p className="text-lg font-bold">
                ${(summary?.totalEarnings || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary?.totalOrders || 0} orders</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fees</span>
              <span className="font-medium text-red-400">
                -${(summary?.platformFees || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlement Countdown */}
      {inSettlementPayouts.length > 0 && (
        <Card className="bg-cyan-500/5 border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Settlement Window
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inSettlementPayouts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-card/50">
                <div>
                  <p className="text-sm font-medium">${Number(p.net_amount || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    Started {p.settlement_start_at ? format(new Date(p.settlement_start_at), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
                <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-xs">
                  {getCountdown(p.settlement_release_at)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payout Ledger */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Payout Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {(!payouts || payouts.length === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-6">No payouts yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {payouts.slice(0, 10).map((payout: any) => (
                <div key={payout.id} className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/30 transition-colors ${payout.dispute_flag ? 'bg-red-500/5 border border-red-500/20' : ''}`}>
                  <div>
                    <p className="text-sm font-medium">
                      {payout.created_at ? format(new Date(payout.created_at), 'MMM d, yyyy') : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gross: ${(payout.amount || 0).toFixed(2)} • Fee: ${(payout.platform_fee || 0).toFixed(2)}
                    </p>
                    {payout.status === 'held' && payout.dispute_flag && (
                      <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="h-3 w-3" /> Under Dispute Review
                      </p>
                    )}
                    {payout.status === 'reversed' && (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {payout.reversal_reason || 'Reversed'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      ${(payout.net_amount || 0).toFixed(2)}
                    </p>
                    <Badge variant="outline" className={`text-xs ${getPayoutStatusColor(payout.status || '')}`}>
                      {getPayoutStatusLabel(payout.status || '')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
