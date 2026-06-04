/**
 * Dynasty Direct Hub — Landing
 * Tile grid linking every DD surface (catalog, orders, fulfillment,
 * suppliers/network, suppliers/portal, suppliers/inventory, shipping,
 * grabba-bridge, analytics, storefronts).
 */
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import {
  Package,
  Store,
  ShoppingCart,
  ClipboardList,
  Truck,
  Map,
  Users,
  Boxes,
  Send,
  Zap,
  BarChart3,
  Settings,
} from 'lucide-react';

const TILES = [
  { path: '/dynasty-direct/catalog', label: 'Catalog', icon: Package, desc: 'Products, images, AI categorization' },
  { path: '/dynasty-direct/store-storefront', label: 'Store Storefront', icon: Store, desc: 'B2B store-facing shop' },
  { path: '/dynasty-direct/d2c-storefront', label: 'D2C Storefront', icon: ShoppingCart, desc: 'Direct-to-consumer shop' },
  { path: '/dynasty-direct/orders', label: 'Orders', icon: ClipboardList, desc: 'Unified orders + payment + tracking', highlight: true },
  { path: '/dynasty-direct/fulfillment', label: 'Fulfillment', icon: Truck, desc: 'Supplier routing + dispatch' },
  { path: '/dynasty-direct/suppliers/network', label: 'Supplier Network', icon: Map, desc: 'State-by-state map of suppliers', highlight: true },
  { path: '/dynasty-direct/suppliers/portal', label: 'Supplier Portal', icon: Users, desc: 'Wholesaler ops portal' },
  { path: '/dynasty-direct/suppliers/inventory', label: 'Inventory', icon: Boxes, desc: 'Per-supplier stock + reservations' },
  { path: '/dynasty-direct/shipping', label: 'Shipping', icon: Send, desc: 'Labels, carriers, EasyPost' },
  { path: '/dynasty-direct/grabba-bridge', label: 'Grabba Bridge', icon: Zap, desc: 'Cross-app order injection' },
  { path: '/dynasty-direct/analytics', label: 'Analytics', icon: BarChart3, desc: 'Control tower KPIs' },
  { path: '/dynasty-direct/invites', label: 'Invites & Access', icon: Send, desc: 'Universal invites — wholesaler, ambassador, store, customer', highlight: true },
  { path: '/admin/dynasty-direct-ops', label: 'Ops Console', icon: Settings, desc: 'Geocoding + profile linking' },
];

export default function DynastyDirectHubHome() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dynasty Direct</h1>
        <p className="text-muted-foreground mt-1">
          Multi-state supplier fulfillment network — catalog, orders, suppliers, shipping, analytics in one hub.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.path} to={t.path}>
              <Card
                className={`p-5 hover:bg-accent/40 transition-colors h-full ${
                  t.highlight ? 'border-primary/50 ring-1 ring-primary/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-primary/10 text-primary p-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
