import { Link } from "react-router-dom";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";
import { useWholesalerProducts } from "@/services/wholesaler/useWholesalerProducts";
import { useWholesalerOrders } from "@/services/wholesaler/useWholesalerOrders";
import { useWholesalerLedger } from "@/services/wholesaler/useWholesalerLedger";
import { Button } from "@/components/ui/button";
import { DDChevron } from "@/components/dynasty-direct/DDMark";
import {
  Package, ShoppingCart, Truck, DollarSign, AlertTriangle,
  Clock, Camera, Plus, Warehouse, FileText,
} from "lucide-react";

function Stat({
  label, value, icon, accent,
}: { label: string; value: string | number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`dd-panel ${accent ? "dd-panel-accent" : ""} px-4 py-3`}>
      <div className="flex items-center gap-2 text-[11px] uppercase" style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}>
        {icon}
        {label}
      </div>
      <div
        className="dd-num mt-1.5 text-[26px] leading-none"
        style={{ color: accent ? "hsl(var(--dd-gold))" : "hsl(var(--dd-navy))" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function WholesalerDashboard() {
  const { profile, isLoading: profileLoading } = useWholesalerProfile();
  const { products, lowStockProducts, isLoading: productsLoading } = useWholesalerProducts();
  const { orders, pendingCount, shippedCount, isLoading: ordersLoading } = useWholesalerOrders();
  // Money comes from dd_split_ledger — the settled-order truth, not the empty payouts table.
  const { summary: ledger, isLoading: financeLoading } = useWholesalerLedger();

  const isLoading = profileLoading || productsLoading || ordersLoading || financeLoading;

  if (isLoading) {
    return <div className="p-8 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] leading-tight" style={{ color: "hsl(var(--dd-navy))" }}>
            {profile?.company_name || "Supplier"}
          </h2>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            Your catalog, orders and settled earnings with Dynasty Direct.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/portal/wholesaler/products"><Package className="h-4 w-4 mr-2" />Products</Link>
          </Button>
          <Button asChild style={{ background: "hsl(var(--dd-gold))", color: "hsl(var(--dd-navy-deep))" }}>
            <Link to="/portal/wholesaler/catalog/onboard"><Camera className="h-4 w-4 mr-2" />Quick Add by Photo</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Products" value={products.length} icon={<Package className="h-3.5 w-3.5" />} />
        <Stat label="Pending orders" value={pendingCount} icon={<Clock className="h-3.5 w-3.5" />} accent={pendingCount > 0} />
        <Stat label="Shipped" value={shippedCount} icon={<Truck className="h-3.5 w-3.5" />} />
        <Stat
          label="Net earned (settled)"
          value={ledger.hasSettledOrders ? `$${ledger.netTotal.toFixed(2)}` : "—"}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          accent={ledger.hasSettledOrders}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Orders */}
        <section className="dd-panel lg:col-span-2">
          <header className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "hsl(var(--dd-line))" }}>
            <h3 className="font-display text-[15px]" style={{ color: "hsl(var(--dd-navy))" }}>Recent orders</h3>
            <Link to="/portal/wholesaler/orders" className="text-[12px] font-semibold" style={{ color: "hsl(var(--dd-navy))" }}>
              View all
            </Link>
          </header>
          {orders.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No orders yet
            </div>
          ) : (
            <ul>
              {orders.slice(0, 6).map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 border-b last:border-b-0"
                  style={{ borderColor: "hsl(var(--dd-line))" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-1.5 h-6"
                      style={{
                        background:
                          order.fulfillment_status === "pending"
                            ? "hsl(var(--dd-gold))"
                            : order.fulfillment_status === "shipped"
                            ? "hsl(var(--success))"
                            : "hsl(var(--dd-navy))",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="dd-num text-[13px]" style={{ color: "hsl(var(--dd-ink))" }}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {order.items?.length || 0} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="dd-num text-[13px]" style={{ color: "hsl(var(--dd-ink))" }}>
                      ${Number(order.total || 0).toFixed(2)}
                    </span>
                    <span className="text-[11px] uppercase" style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.03em" }}>
                      {order.fulfillment_status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          {lowStockProducts.length > 0 && (
            <section className="dd-panel dd-panel-accent">
              <header className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "hsl(var(--dd-line))" }}>
                <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--dd-gold))" }} />
                <h3 className="font-display text-[15px]" style={{ color: "hsl(var(--dd-navy))" }}>Low stock</h3>
              </header>
              <ul className="px-4 py-2">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-1.5 text-[13px]">
                    <span className="truncate">{p.product_name}</span>
                    <span className="dd-num" style={{ color: "hsl(var(--dd-gold))" }}>{p.inventory_qty}</span>
                  </li>
                ))}
              </ul>
              <div className="px-4 pb-4">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/portal/wholesaler/products">Manage inventory</Link>
                </Button>
              </div>
            </section>
          )}

          <section className="dd-panel">
            <header className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--dd-line))" }}>
              <h3 className="font-display text-[15px]" style={{ color: "hsl(var(--dd-navy))" }}>Settled to date</h3>
            </header>
            <dl className="px-4 py-3 space-y-2 text-[13px]">
              {[
                ["Settled orders", String(ledger.entryCount)],
                ["Sales settled", ledger.hasSettledOrders ? `$${ledger.grossTotal.toFixed(2)}` : "—"],
                ["Awaiting transfer", ledger.hasSettledOrders ? `$${ledger.awaitingTransferTotal.toFixed(2)}` : "—"],
              ].map(([k, v], i) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt style={{ color: "hsl(var(--muted-foreground))" }}>{k}</dt>
                  <dd className="dd-num" style={{ color: i === 2 ? "hsl(var(--dd-gold))" : "hsl(var(--dd-ink))" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="dd-panel">
            <header className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--dd-line))" }}>
              <h3 className="font-display text-[15px]" style={{ color: "hsl(var(--dd-navy))" }}>Quick actions</h3>
            </header>
            <div className="py-1">
              {[
                { to: "/portal/wholesaler/catalog/onboard", label: "Add a product", icon: Plus },
                { to: "/portal/wholesaler/orders?status=pending", label: "Process pending orders", icon: Clock },
                { to: "/portal/wholesaler/fulfillment", label: "Print shipping labels", icon: Truck },
                { to: "/portal/wholesaler/inventory", label: "Inventory workflow", icon: Warehouse },
                { to: "/portal/wholesaler/transactions", label: "Transaction history", icon: FileText },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] hover:bg-[hsl(var(--muted))]"
                  style={{ color: "hsl(var(--dd-ink))" }}
                >
                  <DDChevron size={9} color="hsl(var(--dd-navy))" />
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
