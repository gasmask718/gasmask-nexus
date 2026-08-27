import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerFulfillments, type WholesalerFulfillment as WholesalerFulfillmentType } from "@/services/wholesaler/useWholesalerFulfillments";
import { useWholesalerPickSlips, type PickSlip } from "@/services/wholesaler/useWholesalerPickSlips";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HudCard } from "@/components/portal/HudCard";
import { HudMetric } from "@/components/portal/HudMetric";
import {
  ArrowLeft, Search, Truck, Clock, Tag, Printer,
  CheckCircle, Package, MapPin, AlertTriangle, ExternalLink, Loader2
} from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";

function SlaTimer({ createdAt }: { createdAt: string | null }) {
  if (!createdAt) return null;
  const hours = differenceInHours(new Date(), new Date(createdAt));
  const minutes = differenceInMinutes(new Date(), new Date(createdAt)) % 60;

  const color =
    hours < 24 ? "text-green-600 bg-green-500/10 border-green-500/30" :
    hours < 48 ? "text-amber-600 bg-amber-500/10 border-amber-500/30" :
    "text-red-600 bg-red-500/10 border-red-500/30";

  const icon =
    hours >= 48 ? <AlertTriangle className="h-3 w-3" /> :
    <Clock className="h-3 w-3" />;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border ${color}`}>
      {icon}
      {hours}h {minutes}m
    </span>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "pending": return "destructive" as const;
    case "label_generated": return "secondary" as const;
    case "shipped": return "default" as const;
    case "completed": return "outline" as const;
    default: return "outline" as const;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "pending": return "Needs Label";
    case "label_generated": return "Label Ready";
    case "shipped": return "Shipped";
    case "completed": return "Completed";
    default: return status;
  }
}

interface FulfillmentRowProps {
  f: WholesalerFulfillmentType;
  pickSlip?: PickSlip;
  onGenerateLabel: (id: string) => Promise<any>;
  onMarkShipped: (id: string) => Promise<any>;
  isGenerating: boolean;
  isShipping: boolean;
}

function FulfillmentRow({ f, pickSlip, onGenerateLabel, onMarkShipped, isGenerating, isShipping }: FulfillmentRowProps) {

  const [actionId, setActionId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setActionId(f.id);
    try { await onGenerateLabel(f.id); } finally { setActionId(null); }
  };

  const handleShip = async () => {
    setActionId(f.id);
    try { await onMarkShipped(f.id); } finally { setActionId(null); }
  };

  const handlePrint = async () => {
    if (f.shipping_label_url) {
      window.open(f.shipping_label_url, "_blank", "noopener");
      // Log print event to audit trail
      try {
        const { data: label } = await (supabase as any)
          .from("shipping_labels")
          .select("id")
          .eq("fulfillment_id", f.id)
          .eq("status", "created")
          .maybeSingle();
        if (label) {
          await (supabase as any).from("shipping_label_events").insert({
            label_id: label.id,
            fulfillment_id: f.id,
            event_type: "printed",
            meta_json: { carrier: f.carrier, tracking: f.tracking_number },
          });
        }
      } catch (e) {
        console.error("Failed to log print event:", e);
      }
    }
  };

  // Pick slip beats a count: names + quantities, and the box ddBoxing already
  // chose when the rate was bought. Fall back to the snapshot only if the view
  // has no row yet.
  const pickItems = pickSlip?.pick_items?.length
    ? pickSlip.pick_items
    : (Array.isArray(f.items_snapshot) ? f.items_snapshot : []).map((i: any) => ({
        name: i?.name ?? i?.product_name ?? i?.title ?? 'Item',
        qty: Number(i?.qty ?? i?.quantity ?? 1),
        sku: i?.sku ?? null,
      }));
  const itemCount = pickItems.reduce((s, i) => s + (Number(i.qty) || 1), 0);

  const isActing = actionId === f.id;

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">
                #{f.order_id.slice(0, 8).toUpperCase()}
              </span>
              <Badge variant={statusBadgeVariant(f.status)}>
                {statusLabel(f.status)}
              </Badge>
              {f.payment_status && (
                <Badge variant="outline" className="text-xs">
                  {f.payment_status}
                </Badge>
              )}
              <SlaTimer createdAt={f.created_at} />
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </span>
              {f.total && (
                <span className="font-medium text-foreground">
                  ${Number(f.total).toFixed(2)}
                </span>
              )}
              {f.ship_to && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {f.ship_to.city}, {f.ship_to.state}
                </span>
              )}
            </div>

            {f.tracking_number && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {f.carrier} · {f.tracking_number}
              </div>
            )}

            {/* PICK SLIP — what actually goes in the box */}
            {pickItems.length > 0 && (
              <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pick slip
                </div>
                <ul className="text-sm space-y-0.5">
                  {pickItems.map((i, idx) => (
                    <li key={`${i.sku || i.name}-${idx}`} className="flex items-baseline gap-2">
                      <span className="font-mono font-semibold w-8 shrink-0">{i.qty}×</span>
                      <span className="truncate">{i.name}</span>
                      {i.sku && <span className="text-[10px] text-muted-foreground shrink-0">{i.sku}</span>}
                    </li>
                  ))}
                </ul>
                {pickSlip?.box_name ? (
                  <div className="flex items-center gap-1 text-sm font-medium pt-1">
                    <Package className="h-3.5 w-3.5" />
                    Use box: {pickSlip.box_name}
                    {(pickSlip.box_count || 1) > 1 && <span> ×{pickSlip.box_count}</span>}
                    {pickSlip.length_in && (
                      <span className="text-xs text-muted-foreground">
                        ({pickSlip.length_in}×{pickSlip.width_in}×{pickSlip.height_in} in
                        {pickSlip.billable_weight_oz ? `, ${pickSlip.billable_weight_oz} oz billable` : ''})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground pt-1">
                    Box is chosen when the label is created.
                  </div>
                )}
              </div>
            )}


            {f.dispute_status && (
              <div className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Dispute: {f.dispute_reason} ({f.dispute_status})
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {f.status === "pending" && f.payment_status === "paid" && (
              <Button size="sm" onClick={handleGenerate} disabled={isActing}>
                {isActing && isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4 mr-1" />
                )}
                Create Label
              </Button>
            )}

            {f.status === "pending" && f.payment_status !== "paid" && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Awaiting Payment
              </Badge>
            )}

            {f.status === "label_generated" && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button size="sm" onClick={handleShip} disabled={isActing}>
                  {isActing && isShipping ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4 mr-1" />
                  )}
                  Mark Shipped
                </Button>
              </>
            )}

            {f.status === "shipped" && f.shipping_label_url && (
              <Button variant="ghost" size="sm" onClick={handlePrint}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View Label
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WholesalerFulfillment() {
  const {
    fulfillments, isLoading, counts,
    generateLabel, isGeneratingLabel,
    markShipped, isMarkingShipped,
  } = useWholesalerFulfillments();
  const { pickSlips } = useWholesalerPickSlips();


  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");

  const filtered = fulfillments.filter(f => {
    const matchSearch = !search || f.order_id.toLowerCase().includes(search.toLowerCase()) ||
      (f.tracking_number || "").toLowerCase().includes(search.toLowerCase());
    if (tab === "all") return matchSearch;
    return matchSearch && f.status === tab;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/portal/wholesaler">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Fulfillment Queue</h1>
            <p className="text-muted-foreground">
              {counts.total} fulfillments · {counts.pending} need action
            </p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <HudCard variant="amber" glow={counts.pending > 0}>
          <HudMetric
            label="Needs Label"
            value={counts.pending}
            icon={<Clock className="h-4 w-4" />}
            variant="amber"
          />
        </HudCard>
        <HudCard variant="cyan">
          <HudMetric
            label="Label Ready"
            value={counts.label_generated}
            icon={<Tag className="h-4 w-4" />}
            variant="cyan"
          />
        </HudCard>
        <HudCard variant="green">
          <HudMetric
            label="Shipped"
            value={counts.shipped}
            icon={<Truck className="h-4 w-4" />}
            variant="green"
          />
        </HudCard>
        <HudCard variant="purple">
          <HudMetric
            label="Completed"
            value={counts.completed}
            icon={<CheckCircle className="h-4 w-4" />}
            variant="purple"
          />
        </HudCard>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID or tracking number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs + List */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending ({counts.pending})
            {counts.pending > 0 && <span className="ml-1 w-2 h-2 rounded-full bg-amber-500" />}
          </TabsTrigger>
          <TabsTrigger value="label_generated">Label Ready ({counts.label_generated})</TabsTrigger>
          <TabsTrigger value="shipped">Shipped ({counts.shipped})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
              Loading fulfillments...
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No fulfillments</h3>
                <p className="text-muted-foreground">
                  {search ? "No results match your search" : "Nothing in this queue right now"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(f => (
                <FulfillmentRow
                  key={f.id}
                  f={f}
                  pickSlip={pickSlips[f.id]}

                  onGenerateLabel={generateLabel}
                  onMarkShipped={markShipped}
                  isGenerating={isGeneratingLabel}
                  isShipping={isMarkingShipped}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
