import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Rocket,
} from 'lucide-react';

type Level = 'green' | 'red' | 'amber';

interface Check {
  id: string;
  label: string;
  level: Level;
  value: string;
  action: string;
  to?: string;
}

/**
 * The screen the owner opens before flipping the sign to open.
 * Every row is read live — nothing here is a stored "we're ready" flag.
 */
export default function DDReadiness() {
  const q = useQuery({
    queryKey: ['dd-readiness'],
    refetchInterval: 60000,
    queryFn: async (): Promise<Check[]> => {
      const checks: Check[] = [];

      // ── 1. EasyPost key: test vs production ───────────────────────────
      const { data: ai, error: aiErr } = await supabase
        .from('dd_ai_config' as any)
        .select('easypost_api_key, easypost_mode')
        .limit(1)
        .maybeSingle();
      const key = (ai as any)?.easypost_api_key as string | undefined;
      const mode = (ai as any)?.easypost_mode as string | undefined;
      if (aiErr) {
        checks.push({
          id: 'easypost', label: 'EasyPost shipping key', level: 'amber',
          value: 'Cannot read config', action: aiErr.message, to: '/dynasty-direct/settings',
        });
      } else if (!key) {
        checks.push({
          id: 'easypost', label: 'EasyPost shipping key', level: 'red',
          value: 'No key configured',
          action: 'Add a production EasyPost key — no labels can be bought at all.',
          to: '/dynasty-direct/settings',
        });
      } else if (key.startsWith('EZTK') || mode !== 'production') {
        checks.push({
          id: 'easypost', label: 'EasyPost shipping key', level: 'red',
          value: 'TEST key — labels cannot be purchased',
          action:
            'Swap the EZTK… test key for a production EZAK… key. Until then rates quote but no real label, tracking number, or return label can be bought.',
          to: '/dynasty-direct/settings',
        });
      } else {
        checks.push({
          id: 'easypost', label: 'EasyPost shipping key', level: 'green',
          value: 'Production key active', action: 'Labels can be purchased.',
        });
      }

      // ── 2. Stripe webhook: registered and receiving? ──────────────────
      const { data: ev, error: evErr } = await supabase
        .from('dd_webhook_events' as any)
        .select('event_id, type, received_at')
        .order('received_at', { ascending: false })
        .limit(1);
      const last = (ev as any)?.[0];
      if (evErr) {
        checks.push({
          id: 'webhook', label: 'Stripe webhook', level: 'amber',
          value: 'Cannot read event log', action: evErr.message,
        });
      } else if (!last) {
        checks.push({
          id: 'webhook', label: 'Stripe webhook', level: 'red',
          value: 'No events ever received',
          action:
            'Register the dd-stripe-webhook endpoint in Stripe and set DD_STRIPE_WEBHOOK_SECRET. Without it, paid orders never get marked paid.',
        });
      } else {
        const ageH = (Date.now() - new Date(last.received_at).getTime()) / 3_600_000;
        checks.push({
          id: 'webhook', label: 'Stripe webhook', level: ageH < 24 * 7 ? 'green' : 'amber',
          value: `Last event: ${last.type} — ${new Date(last.received_at).toLocaleString()}`,
          action: ageH < 24 * 7 ? 'Receiving events.' : 'Nothing recently — send a Stripe test event to confirm it is still wired.',
        });
      }

      // ── 3. Wholesalers who can actually be paid ───────────────────────
      const { data: ws } = await supabase
        .from('wholesaler_profiles')
        .select('id, company_name, stripe_connect_id, stripe_payouts_enabled');
      const total = ws?.length ?? 0;
      const payable = (ws ?? []).filter((w: any) => w.stripe_connect_id && w.stripe_payouts_enabled).length;
      checks.push({
        id: 'connect', label: 'Wholesalers who can be paid', level: payable > 0 ? 'green' : 'red',
        value: `${payable} of ${total} have Stripe Connect payouts enabled`,
        action: payable > 0
          ? 'Suppliers can receive their split.'
          : 'Nobody can be paid. Send each wholesaler their Connect onboarding link from the wholesaler portal.',
        to: '/dynasty-direct/wholesalers',
      });

      // ── 4. Sellable products ──────────────────────────────────────────
      const { count: liveCount } = await supabase
        .from('products_all')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      const live = liveCount ?? 0;
      checks.push({
        id: 'products', label: 'Sellable products', level: live >= 5 ? 'green' : live > 0 ? 'amber' : 'red',
        value: `${live} active product${live === 1 ? '' : 's'}`,
        action: live >= 5
          ? 'Catalog has something to sell.'
          : live > 0
            ? 'Only a handful live — most likely still test items. Publish real inventory before opening.'
            : 'Nothing is sellable. Publish products (weight + dimensions required, or they cannot go live).',
        to: '/dynasty-direct/products',
      });

      // ── 5. Any real paid orders yet ───────────────────────────────────
      const { count: paidCount } = await supabase
        .from('marketplace_orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'paid');
      const paid = paidCount ?? 0;
      checks.push({
        id: 'orders', label: 'Paid orders', level: paid > 0 ? 'green' : 'amber',
        value: `${paid}`,
        action: paid > 0
          ? 'Money has moved through the pipeline end to end.'
          : 'No order has ever been paid. Run one real low-value order through checkout before launch.',
        to: '/dynasty-direct/orders',
      });

      // ── 6. Returns policy configured ──────────────────────────────────
      const { data: cfg } = await supabase
        .from('dd_config' as any)
        .select('returns_enabled, return_window_days, return_destination_default, dynasty_return_address')
        .limit(1)
        .maybeSingle();
      const rEnabled = (cfg as any)?.returns_enabled !== false;
      const needsDynastyAddr = (cfg as any)?.return_destination_default === 'dynasty'
        && !(cfg as any)?.dynasty_return_address;
      checks.push({
        id: 'returns', label: 'Returns policy', level: !rEnabled ? 'amber' : needsDynastyAddr ? 'red' : 'green',
        value: rEnabled
          ? `Open — ${(cfg as any)?.return_window_days ?? 30}-day window, default destination ${(cfg as any)?.return_destination_default ?? 'wholesaler'}`
          : 'Returns are switched off',
        action: !rEnabled
          ? 'Customers cannot request a return. Turn it on unless that is deliberate.'
          : needsDynastyAddr
            ? 'Default destination is Dynasty but no Dynasty return address is set — labels will fail.'
            : 'Customers can request returns.',
        to: '/dynasty-direct/settings',
      });

      return checks;
    },
  });

  const checks = q.data ?? [];
  const reds = checks.filter((c) => c.level === 'red').length;
  const ready = checks.length > 0 && reds === 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6" /> Dynasty Direct — launch readiness
          </h1>
          <p className="text-muted-foreground text-sm">
            Live checks, not a saved checklist. Every red item blocks real money moving.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => q.refetch()}>
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className={ready ? 'border-emerald-500/40' : 'border-destructive/40'}>
        <CardContent className="p-5 flex items-center gap-3">
          {q.isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : ready ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 text-destructive" />
          )}
          <div>
            <div className="font-semibold">
              {q.isLoading ? 'Checking…' : ready ? 'Clear to open' : `${reds} blocker${reds === 1 ? '' : 's'} before you open`}
            </div>
            <div className="text-sm text-muted-foreground">
              {ready ? 'Everything below is green.' : 'Fix the red rows first — the amber ones are worth knowing but will not break a sale.'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Checks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {q.error && <p className="text-sm text-destructive">{(q.error as any)?.message}</p>}
          {checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-md border p-4">
              {c.level === 'green' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
              {c.level === 'red' && <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
              {c.level === 'amber' && <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.label}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.level === 'green'
                        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        : c.level === 'red'
                          ? 'bg-destructive/15 text-destructive border-destructive/30'
                          : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    }
                  >
                    {c.value}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.action}</p>
              </div>
              {c.to && (
                <Button asChild size="sm" variant="ghost">
                  <Link to={c.to}>Open</Link>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
