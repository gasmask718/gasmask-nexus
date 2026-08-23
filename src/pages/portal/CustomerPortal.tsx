import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/services/marketplace/useCart";
import { supabase } from "@/integrations/supabase/client";
import { enrichOrderItems } from "@/services/marketplace/enrichOrderItems";
import PortalDashboard from "@/layouts/PortalDashboard";
import { HudCard } from "@/components/portal/HudCard";
import { HudButton } from "@/components/portal/HudButton";
import { HudMetric } from "@/components/portal/HudMetric";
import { HudStatusBadge } from "@/components/portal/HudStatusBadge";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';
import {
  ShoppingBag,
  Package,
  MapPin,
  Gift,
  MessageCircle,
  Clock,
  ChevronRight,
  Star,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Download,
} from "lucide-react";
import { format } from "date-fns";

type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered";

const fulfillmentToBadge: Record<
  FulfillmentStatus,
  { status: "pending" | "active" | "completed" | "warning"; label: string }
> = {
  pending: { status: "pending", label: "Pending" },
  processing: { status: "active", label: "Processing" },
  shipped: { status: "warning", label: "In Transit" },
  delivered: { status: "completed", label: "Delivered" },
};

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profileData } = useCurrentUserProfile();
  const { t } = useTranslation();
  const { items: cartItems, totals } = useCart();
  const ordersRef = useRef<HTMLDivElement>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const location = useLocation();

  // OpsBottomNav subpaths: /portal/customer (home), /orders, /rewards, /profile
  const subpath = location.pathname.split("/")[3] || "";
  const section = (["orders", "rewards", "profile"].includes(subpath) ? subpath : "home") as
    "home" | "orders" | "rewards" | "profile";

  const profile = profileData?.profile;

  // Fetch profile details
  const { data: profileDetails } = useQuery({
    queryKey: ["customer-profile-details", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name, email, phone").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Fetch real orders with items
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select(
          `
          id, created_at, order_type, payment_status, fulfillment_status,
          subtotal, shipping_cost, tax_amount, total, shipping_address, notes,
          items:marketplace_order_items(
            id, qty, price_each, product_id
          )
        `,
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const results = [];
      for (const order of (data || [])) {
        const enrichedItems = await enrichOrderItems(order.items || []);
        results.push({ ...order, items: enrichedItems });
      }
      return results;
    },
    enabled: !!user,
  });

  // Derived stats
  const totalOrders = orders?.length ?? 0;
  const activeDeliveries = orders?.filter((o) => o.fulfillment_status === "shipped") ?? [];
  const uniqueAddresses = (() => {
    if (!orders) return 0;
    const seen = new Set<string>();
    orders.forEach((o) => {
      if (o.shipping_address) {
        seen.add(JSON.stringify(o.shipping_address));
      }
    });
    return seen.size;
  })();

  const scrollToOrders = () => {
    ordersRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const displayName = profile?.full_name || profileDetails?.name || "Customer";
  const displayEmail = profileDetails?.email || user?.email || "";
  const displayPhone = profileDetails?.phone || "";

  return (
    <PortalDashboard title={t("my_account")} subtitle={`Welcome back, ${displayName}!`}>
      <div className="space-y-6">
        {/* Account Info */}
        <HudCard>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/20">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{displayName}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {displayEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {displayEmail}
                  </span>
                )}
                {displayPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {displayPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </HudCard>

        {/* PWA Install Card */}
        <PwaInstallBanner appName="GasMask" />

        {/* Active Delivery Banner */}
        {activeDeliveries.length > 0 && (
          <HudCard variant="cyan" className="border-hud-cyan/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-hud-cyan/20">
                  <Package className="h-6 w-6 text-hud-cyan" />
                </div>
                <div>
                  <p className="text-hud-cyan font-semibold">
                    {activeDeliveries.length === 1
                      ? t("order_on_the_way")
                      : `${activeDeliveries.length} orders in transit`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeDeliveries[0].id.slice(0, 8).toUpperCase()}
                    {activeDeliveries.length > 1 && ` + ${activeDeliveries.length - 1} more`}
                  </p>
                </div>
              </div>
              <HudButton variant="cyan" size="sm" onClick={scrollToOrders}>
                {t("track_order")}
              </HudButton>
            </div>
          </HudCard>
        )}

        {/* Quick Stats + Actions (home section only) */}
        {section === "home" && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HudCard variant="cyan">
            <HudMetric
              label={t("total_orders")}
              value={ordersLoading ? "..." : String(totalOrders)}
              icon={<ShoppingBag className="h-4 w-4" />}
              variant="cyan"
              size="sm"
            />
          </HudCard>
          <HudCard variant="amber">
            <div className="relative">
              <HudMetric
                label={t("rewards_points")}
                value="—"
                icon={<Star className="h-4 w-4" />}
                variant="amber"
                size="sm"
              />
              <div className="absolute top-0 right-0">
                <ComingSoonBadge />
              </div>
            </div>
          </HudCard>
          <HudCard variant="green">
            <HudMetric
              label={t("saved_addresses")}
              value={ordersLoading ? "..." : String(uniqueAddresses)}
              icon={<MapPin className="h-4 w-4" />}
              variant="green"
              size="sm"
            />
          </HudCard>
          <HudCard variant="purple">
            <div className="relative">
              <HudMetric
                label={t("available_deals")}
                value="—"
                icon={<Gift className="h-4 w-4" />}
                variant="purple"
                size="sm"
              />
              <div className="absolute top-0 right-0">
                <ComingSoonBadge />
              </div>
            </div>
          </HudCard>
        </div>

        {/* Main Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="cursor-pointer" onClick={() => navigate("/shop")}>
            <HudCard variant="cyan" className="hover:border-hud-cyan/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-cyan/20">
                  <ShoppingBag className="h-8 w-8 text-hud-cyan" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t("shop_now")}</h3>
                  <p className="text-sm text-muted-foreground">{t("browse_products")}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          <div className="cursor-pointer" onClick={scrollToOrders}>
            <HudCard variant="green" className="hover:border-hud-green/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-green/20">
                  <Package className="h-8 w-8 text-hud-green" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t("my_orders")}</h3>
                  <p className="text-sm text-muted-foreground">{totalOrders} orders</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          <div className="cursor-pointer" onClick={() => navigate("/cart")}>
            <HudCard variant="amber" className="hover:border-hud-amber/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-amber/20 relative">
                  <ShoppingCart className="h-8 w-8 text-hud-amber" />
                  {totals.itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                      {totals.itemCount}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Cart</h3>
                  <p className="text-sm text-muted-foreground">
                    {totals.itemCount > 0 ? `${totals.itemCount} items • $${totals.subtotal.toFixed(2)}` : "Empty"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>
        </div>
        </>
        )}

        {/* Rewards (rewards section) — program not live yet, honest state */}
        {section === "rewards" && (
          <HudCard variant="amber">
            <div className="text-center py-10 space-y-3">
              <Gift className="mx-auto h-10 w-10 text-hud-amber/60" />
              <h3 className="font-bold text-lg">Rewards & Loyalty</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The rewards program isn't live yet. When it launches you'll earn points on
                every purchase and redeem them here — nothing needed from you in the meantime.
              </p>
              <div className="flex justify-center pt-1">
                <ComingSoonBadge />
              </div>
            </div>
          </HudCard>
        )}

        {/* Profile (profile section) — read-only, editing not wired yet */}
        {section === "profile" && (
          <HudCard>
            <h3 className="font-bold text-lg mb-4">Profile Details</h3>
            <dl className="space-y-3 max-w-md">
              <div className="flex justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="text-sm font-medium">{displayName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="text-sm font-medium">{displayEmail || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="text-sm font-medium">{displayPhone || "—"}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground mt-6">
              Profile editing isn't available in the portal yet — contact support to update your details.
            </p>
          </HudCard>
        )}

        {/* Order History */}
        {(section === "home" || section === "orders") && (
        <div ref={ordersRef}>
          <HudCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{t("recent_orders")}</h3>
              {totalOrders > 0 && <span className="text-sm text-muted-foreground">{totalOrders} total</span>}
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
                <HudButton variant="cyan" className="mt-4" onClick={() => navigate("/shop")}>
                  Start Shopping
                </HudButton>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const badge = fulfillmentToBadge[(order.fulfillment_status as FulfillmentStatus) || "pending"];
                  const isExpanded = expandedOrderId === order.id;
                  const itemCount = order.items?.reduce((sum: number, item: any) => sum + (item.qty || 0), 0) ?? 0;

                  return (
                    <div key={order.id} className="rounded-lg bg-background/50 border border-border/50 overflow-hidden">
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{order.id.slice(0, 8).toUpperCase()}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(order.created_at), "MMM d, yyyy")} • {itemCount} item
                              {itemCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <HudStatusBadge status={badge.status} label={badge.label} />
                          <span className="font-bold">${(order.total ?? 0).toFixed(2)}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/50 p-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Payment</span>
                              <p className="font-medium capitalize">{order.payment_status || "pending"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Subtotal</span>
                              <p className="font-medium">${(order.subtotal ?? 0).toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Shipping</span>
                              <p className="font-medium">${(order.shipping_cost ?? 0).toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tax</span>
                              <p className="font-medium">${(order.tax_amount ?? 0).toFixed(2)}</p>
                            </div>
                          </div>

                          {order.shipping_address && (
                            <div className="text-sm">
                              <span className="text-muted-foreground flex items-center gap-1 mb-1">
                                <MapPin className="h-3 w-3" /> Shipping Address
                              </span>
                              <p className="font-medium">
                                {typeof order.shipping_address === "object"
                                  ? Object.values(order.shipping_address as Record<string, string>)
                                      .filter(Boolean)
                                      .join(", ")
                                  : String(order.shipping_address)}
                              </p>
                            </div>
                          )}

                          {order.items && order.items.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-sm text-muted-foreground">Items</span>
                              {order.items.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                  {item.product?.images?.[0] ? (
                                    <img
                                      src={item.product.images[0]}
                                      alt={item.product?.product_name || "Product"}
                                      className="w-10 h-10 rounded-md object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {item.product?.product_name || "Unknown Product"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Qty: {item.qty} × ${(item.price_each ?? 0).toFixed(2)}
                                    </p>
                                  </div>
                                  <span className="text-sm font-bold">
                                    ${((item.qty || 0) * (item.price_each || 0)).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </HudCard>
        </div>
        )}
      </div>
    </PortalDashboard>
  );
}
