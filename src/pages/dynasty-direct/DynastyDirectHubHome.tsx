/**
 * Dynasty Direct Hub — Landing
 *
 * Section-grouped tile grid (Commerce / Network / Growth / System) with live
 * KPI badges. Drives the operator's daily glance.
 */
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DDShell } from '@/components/dynasty-direct/DDShell';
import { DDPageHeader } from '@/components/dynasty-direct/DDPageHeader';
import { useDDHubKpis, type DDHubKpis } from '@/hooks/useDDHubKpis';
import {
  Package, Store, ShoppingCart, ClipboardList, Truck, Map, Users, Boxes, Send,
  Zap, BarChart3, Settings, Handshake, Sparkles, Heart, ShieldCheck, Inbox,
} from 'lucide-react';

interface Tile {
  path: string;
  label: string;
  icon: any;
  desc: string;
  /** Pull live KPI text from the hook payload, or null for "nothing yet" zero-state. */
  badge?: (k: DDHubKpis) => { label: string; tone?: 'default' | 'warn' | 'critical' | 'cta' } | null;
}

const fmt = (n: number) => n.toLocaleString();
const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COMMERCE: Tile[] = [
  {
    path: '/dynasty-direct/orders', label: 'Orders', icon: ClipboardList,
    desc: 'Unified orders + payment + tracking',
    badge: (k) => {
      if (k.unpaidOrders === 0 && k.awaitingLabel === 0 && k.paidThisWeek === 0)
        return { label: 'Seed first order', tone: 'cta' };
      const parts: string[] = [];
      if (k.unpaidOrders) parts.push(`${k.unpaidOrders} unpaid`);
      if (k.awaitingLabel) parts.push(`${k.awaitingLabel} awaiting label`);
      parts.push(`${k.paidThisWeek} paid this wk`);
      return {
        label: parts.join(' · '),
        tone: k.unpaidOrders > 0 ? 'warn' : 'default',
      };
    },
  },
  { path: '/dynasty-direct/catalog', label: 'Catalog', icon: Package, desc: 'Products, images, AI categorization' },
  { path: '/dynasty-direct/catalog/onboard', label: 'Onboard a Product', icon: Sparkles, desc: 'AI-assisted wizard' },
  { path: '/dynasty-direct/content-library', label: 'Content Library', icon: Sparkles,
    desc: 'UGC scripts + photoshoots + captions',
    badge: (k) => k.contentBriefs === 0
      ? { label: 'Onboard a product →', tone: 'cta' }
      : { label: `${fmt(k.contentBriefs)} briefs` } },
  { path: '/dynasty-direct/store-storefront', label: 'Store Storefront', icon: Store, desc: 'B2B store-facing shop' },
  { path: '/dynasty-direct/d2c-storefront', label: 'D2C Storefront', icon: ShoppingCart, desc: 'Direct-to-consumer shop' },
];

const NETWORK: Tile[] = [
  {
    path: '/dynasty-direct/fulfillment', label: 'Fulfillment', icon: Truck,
    desc: 'Supplier routing, pins, live feed',
    badge: (k) => {
      if (k.routingFailures24h > 0) return { label: `${k.routingFailures24h} failures 24h`, tone: 'critical' };
      if (k.unroutedFulfillments > 0) return { label: `${k.unroutedFulfillments} unrouted`, tone: 'warn' };
      return null;
    },
  },
  {
    path: '/dynasty-direct/suppliers/network', label: 'Supplier Network', icon: Map,
    desc: 'State-by-state map of suppliers',
    badge: (k) => {
      if (k.activeSuppliers === 0) return { label: 'Invite first supplier', tone: 'cta' };
      const tone = k.needGeocode > 0 ? 'warn' : 'default';
      const txt = k.needGeocode > 0
        ? `${fmt(k.activeSuppliers)} active · ${k.needGeocode} need geocode`
        : `${fmt(k.activeSuppliers)} active`;
      return { label: txt, tone };
    },
  },
  { path: '/dynasty-direct/suppliers/portal', label: 'Supplier Portal', icon: Users, desc: 'Wholesaler ops portal' },
  { path: '/dynasty-direct/suppliers/inventory', label: 'Inventory', icon: Boxes, desc: 'Per-supplier stock + reservations' },
  { path: '/dynasty-direct/shipping', label: 'Shipping', icon: Send, desc: 'Labels, carriers, EasyPost' },
  { path: '/dynasty-direct/grabba-bridge', label: 'Grabba Bridge', icon: Zap, desc: 'Cross-app order injection' },
];

const GROWTH: Tile[] = [
  {
    path: '/dynasty-direct/invites', label: 'Invites & Access', icon: Send,
    desc: 'Universal invites — supplier, ambassador, store, customer',
    badge: (k) => k.openInvites === 0
      ? { label: 'Send first invite', tone: 'cta' }
      : { label: `${k.openInvites} awaiting accept`, tone: 'warn' },
  },
  {
    path: '/dynasty-direct/store-applications', label: 'Apply-as-Store Queue', icon: ClipboardList,
    desc: 'Approve store applicants → grants role + fires invite',
    badge: (k) => k.pendingApplications === 0
      ? { label: 'Queue clear' }
      : { label: `${k.pendingApplications} pending`, tone: 'warn' },
  },
  {
    path: '/dynasty-direct/affiliates', label: 'Affiliates', icon: Handshake,
    desc: 'Codes, clicks, conversions, commission ledger & payouts',
    badge: (k) => {
      if (k.affiliatesActive === 0) return { label: 'Recruit first affiliate', tone: 'cta' };
      if (k.affiliatePayoutDue > 0) return { label: `${money(k.affiliatePayoutDue)} payout due`, tone: 'warn' };
      return { label: `${k.affiliatesActive} active` };
    },
  },
  { path: '/dynasty-direct/analytics', label: 'Analytics', icon: BarChart3, desc: 'Control tower KPIs' },
];

const SYSTEM: Tile[] = [
  { path: '/admin/dynasty-direct-ops', label: 'Ops Console', icon: Settings, desc: 'Geocoding + profile linking' },
  {
    path: '/dynasty-direct/messages', label: 'Contact Inbox', icon: Inbox,
    desc: 'Public /contact form submissions',
    badge: (k) => k.newContactMessages === 0
      ? { label: 'Inbox clear' }
      : { label: `${fmt(k.newContactMessages)} new`, tone: 'cta' },
  },
  {
    path: '/compliance/compliance-center', label: 'Comms Health', icon: ShieldCheck,
    desc: 'Twilio balance, webhooks, probes',
    badge: (k) => {
      if (k.twilioBalanceUsd == null) return null;
      if (k.twilioBalanceUsd < 10) return { label: `Bal ${money(k.twilioBalanceUsd)} — critical`, tone: 'critical' };
      if (k.twilioBalanceUsd < 25) return { label: `Bal ${money(k.twilioBalanceUsd)} — low`, tone: 'warn' };
      return { label: `Bal ${money(k.twilioBalanceUsd)}` };
    },
  },
];

const SECTIONS = [
  { name: 'Commerce', icon: ShoppingCart, tiles: COMMERCE },
  { name: 'Network', icon: Truck, tiles: NETWORK },
  { name: 'Growth', icon: Heart, tiles: GROWTH },
  { name: 'System', icon: ShieldCheck, tiles: SYSTEM },
];

function toneClass(tone: string | undefined) {
  switch (tone) {
    case 'critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'warn': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'cta': return 'bg-primary/15 text-primary border-primary/30';
    default: return 'bg-muted text-muted-foreground border-transparent';
  }
}

export default function DynastyDirectHubHome() {
  const { data: kpis, isLoading } = useDDHubKpis();

  return (
    <DDShell>
      <DDPageHeader
        icon={Package}
        title="Dynasty Direct"
        purpose="Multi-state supplier fulfillment network — catalog, orders, suppliers, shipping, analytics in one hub."
      />

      <div className="space-y-8">
        {SECTIONS.map(({ name, icon: SectionIcon, tiles }) => (
          <section key={name}>
            <div className="flex items-center gap-2 mb-3">
              <SectionIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{name}</h2>
              <div className="flex-1 border-t border-border/40" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tiles.map((t) => {
                const Icon = t.icon;
                const badge = kpis && t.badge ? t.badge(kpis) : null;
                return (
                  <Link key={t.path} to={t.path}>
                    <Card className="p-4 hover:bg-accent/40 transition-colors h-full border-border/50">
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-primary/10 text-primary p-2">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{t.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                          {t.badge && (
                            <div className="mt-2">
                              {isLoading ? (
                                <Badge variant="outline" className="text-[10px] animate-pulse">…</Badge>
                              ) : badge ? (
                                <Badge variant="outline" className={`text-[10px] ${toneClass(badge.tone)}`}>
                                  {badge.label}
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </DDShell>
  );
}
