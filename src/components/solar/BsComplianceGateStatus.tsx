/**
 * BrightSun Solar — compliance gate status (Floor 2 / AI Outreach).
 *
 * Read-only view of the single outbound enforcement point:
 * suppression, legal STOP, jurisdiction (bs_geo_policy) and consent artifacts.
 * This is BrightSun-only and has nothing to do with Grabba's Outreach Switchboard.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const REASON_LABELS: Record<string, string> = {
  suppressed: 'On do-not-call',
  legal_stop: 'Replied STOP',
  geo_policy_missing: 'No jurisdiction policy for state',
  geo_blocked: 'State outbound disabled',
  geo_gate_uncleared: 'State gate not cleared',
  lead_state_unknown: 'Lead has no state',
  no_consent_artifact: 'No consent on file',
  consent_expired: 'Consent expired',
  consent_revoked: 'Consent revoked',
  invalid_phone: 'Unusable phone number',
  gate_error: 'Gate error (failed closed)',
};

export function BsComplianceGateStatus() {
  const { data: geoStates } = useQuery({
    queryKey: ['bs-geo-policy-status'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bs_geo_policy')
        .select('state, outbound_allowed, blocking_gate, gate_cleared_at');
      if (error) return null; // table not created yet = everything fails closed
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const { data: consentCount } = useQuery({
    queryKey: ['bs-consent-count'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('bs_consent_artifacts')
        .select('id', { count: 'exact', head: true })
        .is('revoked_at', null);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const { data: refusals = [] } = useQuery({
    queryKey: ['bs-outbound-refusals'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('bs_outbound_refusals')
        .select('id, created_at, caller_function, channel, reason_code, phone, lead_state')
        .order('created_at', { ascending: false })
        .limit(25);
      return data ?? [];
    },
    refetchInterval: 20000,
  });

  const allowedStates = (geoStates ?? []).filter(
    (s: any) => s.outbound_allowed && (!s.blocking_gate || s.gate_cleared_at),
  );
  const gateOpen = allowedStates.length > 0 && (consentCount ?? 0) > 0;

  const byReason = refusals.reduce((acc: Record<string, number>, r: any) => {
    acc[r.reason_code] = (acc[r.reason_code] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className={gateOpen ? 'border-amber-500/30' : 'border-destructive/40 bg-destructive/5'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {gateOpen
            ? <ShieldCheck className="h-4 w-4 text-amber-500" />
            : <ShieldAlert className="h-4 w-4 text-destructive" />}
          Outbound Compliance Gate
          <Badge variant="outline" className={gateOpen
            ? 'bg-amber-500/10 text-amber-500 border-amber-500/40'
            : 'bg-destructive/15 text-destructive border-destructive/40'}>
            {gateOpen ? 'Some states open' : 'Closed — all outbound refused'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-xs text-muted-foreground">
          Every BrightSun call and text passes through one enforcement point before
          any audio or message: do-not-call, STOP, jurisdiction, and consent — all
          failing closed. Refusals below are logged with the function that tried.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">States allowed</p>
            <p className="text-xl font-bold">{geoStates === null ? '—' : allowedStates.length}</p>
            <p className="text-[11px] text-muted-foreground">
              {geoStates === null ? 'no jurisdiction policy table yet' : `of ${geoStates.length} on file`}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Consent artifacts</p>
            <p className="text-xl font-bold">{consentCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">active, not revoked</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Recent refusals</p>
            <p className="text-xl font-bold">{refusals.length}</p>
            <p className="text-[11px] text-muted-foreground">last 25 logged</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Top reason</p>
            <p className="text-sm font-semibold truncate">
              {Object.keys(byReason).length
                ? REASON_LABELS[Object.entries(byReason).sort((a, b) => b[1] - a[1])[0][0]] ?? '—'
                : '—'}
            </p>
          </div>
        </div>

        {refusals.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border/60">
            {refusals.slice(0, 8).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="font-mono">{r.phone ?? '—'}</span>
                <span className="text-muted-foreground">{r.lead_state ?? '—'}</span>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {REASON_LABELS[r.reason_code] ?? r.reason_code}
                </Badge>
                <span className="text-muted-foreground truncate">{r.caller_function} · {r.channel}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BsComplianceGateStatus;
