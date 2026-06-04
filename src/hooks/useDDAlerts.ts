/**
 * Dynasty Direct AlertBar feed.
 * Composes alerts from comms_health_checks + KPI counters + Twilio balance,
 * applies per-alert snooze (localStorage), and returns ranked alerts.
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { DD_ALERT_THRESHOLDS, type Severity } from '@/lib/dynastyDirect/thresholds';
import { useDDHubKpis } from './useDDHubKpis';

export interface DDAlert {
  id: string;                  // stable key for snooze
  severity: Severity;
  title: string;
  detail: string;
  href?: string;
  resolvedKey?: string;        // until-resolved snoozing watches this value
}

const SNOOZE_KEY = 'dd_alerts.snoozes.v1';

interface SnoozeEntry {
  until: number | null;        // ms timestamp, or null = until resolved
  resolvedKey?: string;
}

function loadSnoozes(): Record<string, SnoozeEntry> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
  } catch { return {}; }
}
function saveSnoozes(s: Record<string, SnoozeEntry>) {
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(s));
}

export function useDDAlerts() {
  const kpis = useDDHubKpis();
  const [snoozes, setSnoozes] = useState<Record<string, SnoozeEntry>>(() => loadSnoozes());

  // Re-evaluate snooze expirations every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const snooze = useCallback((id: string, minutes: number | null, resolvedKey?: string) => {
    const next = {
      ...snoozes,
      [id]: { until: minutes ? Date.now() + minutes * 60_000 : null, resolvedKey },
    };
    setSnoozes(next);
    saveSnoozes(next);
  }, [snoozes]);

  const clearSnooze = useCallback((id: string) => {
    const next = { ...snoozes };
    delete next[id];
    setSnoozes(next);
    saveSnoozes(next);
  }, [snoozes]);

  const raw: DDAlert[] = useMemo(() => {
    const k = kpis.data;
    if (!k) return [];
    const out: DDAlert[] = [];

    // Twilio balance
    if (k.twilioBalanceUsd != null) {
      const bal = k.twilioBalanceUsd;
      if (bal < DD_ALERT_THRESHOLDS.twilioBalance.criticalBelow) {
        out.push({
          id: 'twilio-balance',
          severity: 'critical',
          title: `Twilio balance critical — $${bal.toFixed(2)}`,
          detail: 'Comms will fail when funds run out. Top up immediately.',
          href: '/voice-ops/dashboard',
          resolvedKey: `bal>=${DD_ALERT_THRESHOLDS.twilioBalance.criticalBelow}`,
        });
      } else if (bal < DD_ALERT_THRESHOLDS.twilioBalance.warnBelow) {
        out.push({
          id: 'twilio-balance',
          severity: 'warn',
          title: `Twilio balance low — $${bal.toFixed(2)}`,
          detail: `Below $${DD_ALERT_THRESHOLDS.twilioBalance.warnBelow} warning floor.`,
          href: '/voice-ops/dashboard',
          resolvedKey: `bal>=${DD_ALERT_THRESHOLDS.twilioBalance.warnBelow}`,
        });
      }
    }

    // Comms health failures (last hour)
    if (k.commsHealthFails > 0) {
      out.push({
        id: 'comms-health-fail',
        severity: 'critical',
        title: `Comms health: ${k.commsHealthFails} FAIL${k.commsHealthFails === 1 ? '' : 's'} in last hour`,
        detail: 'Voice / SMS layer is degraded.',
        href: '/compliance/compliance-center',
        resolvedKey: 'comms_fails=0',
      });
    }

    // Routing failures in 24h
    if (k.routingFailures24h > 0) {
      out.push({
        id: 'routing-fails-24h',
        severity: 'critical',
        title: `${k.routingFailures24h} routing failure${k.routingFailures24h === 1 ? '' : 's'} in last 24h`,
        detail: 'Orders may be stuck. Investigate the routing feed.',
        href: '/dynasty-direct/fulfillment',
        resolvedKey: `fails24h=0`,
      });
    }

    // Paid orders this week = 0
    if (DD_ALERT_THRESHOLDS.paidOrders.warnIfWeekZero && k.paidThisWeek === 0) {
      out.push({
        id: 'no-paid-orders-week',
        severity: 'warn',
        title: 'No paid orders this week',
        detail: 'Storefront has zero revenue events for the current ISO week.',
        href: '/dynasty-direct/orders',
        resolvedKey: 'paid>0',
      });
    }

    // Unrouted fulfillments
    if (k.unroutedFulfillments > 0) {
      out.push({
        id: 'unrouted-fulfillments',
        severity: 'warn',
        title: `${k.unroutedFulfillments} unrouted fulfillment${k.unroutedFulfillments === 1 ? '' : 's'}`,
        detail: 'Awaiting supplier assignment.',
        href: '/dynasty-direct/fulfillment',
        resolvedKey: 'unrouted=0',
      });
    }

    // Suppliers need geocoding
    if (k.needGeocode > 0) {
      out.push({
        id: 'suppliers-need-geocode',
        severity: 'warn',
        title: `${k.needGeocode} supplier${k.needGeocode === 1 ? '' : 's'} need geocoding`,
        detail: 'Distance-based routing requires warehouse coordinates.',
        href: '/admin/dynasty-direct-ops',
        resolvedKey: 'geocode=0',
      });
    }

    // Pending approvals
    if (DD_ALERT_THRESHOLDS.approvals.infoIfAnyPending && k.pendingApplications > 0) {
      out.push({
        id: 'pending-applications',
        severity: 'info',
        title: `${k.pendingApplications} store application${k.pendingApplications === 1 ? '' : 's'} pending review`,
        detail: 'Approve or reject in the queue.',
        href: '/dynasty-direct/store-applications',
        resolvedKey: 'apps=0',
      });
    }

    // Stale health check
    if (k.lastHealthCheck) {
      const mins = (Date.now() - new Date(k.lastHealthCheck).getTime()) / 60_000;
      if (mins > DD_ALERT_THRESHOLDS.cronStaleness.criticalAfterMinutes) {
        out.push({
          id: 'health-cron-stale',
          severity: 'critical',
          title: `Comms-health cron stale (${Math.round(mins)}m)`,
          detail: 'Monitor has not reported recently.',
          resolvedKey: `fresh<${DD_ALERT_THRESHOLDS.cronStaleness.criticalAfterMinutes}`,
        });
      } else if (mins > DD_ALERT_THRESHOLDS.cronStaleness.warnAfterMinutes) {
        out.push({
          id: 'health-cron-stale',
          severity: 'warn',
          title: `Comms-health cron lagging (${Math.round(mins)}m)`,
          detail: 'Last probe is older than the warn threshold.',
          resolvedKey: `fresh<${DD_ALERT_THRESHOLDS.cronStaleness.warnAfterMinutes}`,
        });
      }
    }

    return out;
  }, [kpis.data]);

  const visible = useMemo(() => {
    const now = Date.now();
    return raw.filter((a) => {
      const s = snoozes[a.id];
      if (!s) return true;
      if (s.until != null && s.until > now) return false;
      if (s.until == null) {
        // until-resolved snooze — drop until resolvedKey changes
        return s.resolvedKey !== a.resolvedKey;
      }
      return true;
    }).sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity));
  }, [raw, snoozes]);

  return {
    alerts: visible,
    allAlerts: raw,
    snooze,
    clearSnooze,
    isLoading: kpis.isLoading,
    error: kpis.error,
  };
}

function sevWeight(s: Severity) {
  return s === 'critical' ? 3 : s === 'warn' ? 2 : 1;
}
