import { ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingCart, Truck, DollarSign,
  FileText, Warehouse, MessageSquare, Users, Settings, Camera,
} from "lucide-react";
import { DDMark, DDChevron } from "./DDMark";
import { useWholesalerProfile } from "@/services/wholesaler/useWholesalerProfile";

const NAV: { to: string; label: string; icon: typeof Package; end?: boolean }[] = [
  { to: "/portal/wholesaler", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/portal/wholesaler/products", label: "Products", icon: Package },
  { to: "/portal/wholesaler/orders", label: "Orders", icon: ShoppingCart },
  { to: "/portal/wholesaler/fulfillment", label: "Fulfillment", icon: Truck },
  { to: "/portal/wholesaler/inventory", label: "Inventory", icon: Warehouse },
  { to: "/portal/wholesaler/finance", label: "Earnings", icon: DollarSign },
  { to: "/portal/wholesaler/transactions", label: "Transactions", icon: FileText },
  { to: "/portal/wholesaler/messages", label: "Messages", icon: MessageSquare },
  { to: "/portal/wholesaler/team", label: "Team", icon: Users },
  { to: "/portal/wholesaler/settings", label: "Settings", icon: Settings },
];

export function DDPortalShell({ children }: { children?: ReactNode }) {
  const { profile } = useWholesalerProfile();
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  return (
    <div className="dd-theme flex min-h-[calc(100vh-3.5rem)]">
      {/* ── Chrome: navy-deep sidebar ─────────────────────────── */}
      <aside
        className="hidden lg:flex w-60 shrink-0 flex-col border-r"
        style={{
          background: "hsl(var(--dd-navy-deep))",
          borderColor: "hsl(var(--dd-navy))",
        }}
      >
        <Link
          to="/portal/wholesaler"
          className="flex items-center h-16 px-5 border-b"
          style={{ borderColor: "hsl(var(--dd-navy))" }}
        >
          <DDMark size={26} withWordmark onDark />
        </Link>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="block">
              {({ isActive }) => (
                <div
                  className="relative flex items-center gap-3 pl-5 pr-3 py-2.5 text-[13px] transition-colors"
                  style={{
                    color: isActive ? "#fff" : "rgba(255,255,255,0.62)",
                    background: isActive ? "hsl(var(--dd-navy))" : "transparent",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {/* the mark's arrow, doing real work as the active marker */}
                  <span className="absolute left-0 top-1/2 -translate-y-1/2">
                    {isActive && <DDChevron size={13} />}
                  </span>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/portal/wholesaler/catalog/onboard"
          className="m-4 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold"
          style={{ background: "hsl(var(--dd-gold))", color: "hsl(var(--dd-navy-deep))" }}
        >
          <Camera className="h-4 w-4" strokeWidth={2} />
          Quick Add by Photo
        </Link>
      </aside>

      {/* ── Working area ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: "hsl(var(--dd-paper))" }}>
        <header
          className="h-16 shrink-0 flex items-center justify-between px-5 border-b bg-white"
          style={{ borderColor: "hsl(var(--dd-line))" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden">
              <DDMark size={24} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-[17px] truncate" style={{ color: "hsl(var(--dd-navy))" }}>
                {current?.label ?? "Supplier Portal"}
              </h1>
              <p className="text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                Supplier Portal
              </p>
            </div>
          </div>
          <div className="text-right min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--dd-ink))" }}>
              {profile?.company_name || "Supplier"}
            </p>
            {profile?.status && (
              <p className="text-[11px] uppercase" style={{ color: "hsl(var(--dd-gold))", letterSpacing: "0.02em" }}>
                {profile.status}
              </p>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export default DDPortalShell;
