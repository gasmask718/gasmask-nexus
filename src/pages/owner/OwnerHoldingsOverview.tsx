import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  TrendingUp,
  Home,
  Bot,
  Coins,
  Trophy,
  ChevronRight,
  LineChart,
  FileText,
  Sparkles,
  Settings2,
} from 'lucide-react';

/**
 * Owner Holdings — INVESTMENT COMMAND DECK
 * No hardcoded portfolio numbers. Every card is a doorway into a real (or honestly-pending) investment hub.
 *  - Sports:    live from sbo_accuracy_log + sbo_saved_picks; bankroll honest-empty until sbo_actual_bets/sbo_bankroll seeded.
 *  - RE:        live-thin from re_deals / re_leads / re_buyers.
 *  - Business:  rollup link into Accounting OS (revenue_events count).
 *  - Stocks/Notes: "Investment Engine — in design" (R2-NEW-1).
 *  - Crypto/Auto-Trading: external platform — connection pending (R2-NEW-2).
 */
export default function OwnerHoldingsOverview() {
  const navigate = useNavigate();

  // ── SPORTS: live model accuracy + saved-pick volume ──────────────────────
  const sports = useQuery({
    queryKey: ['owner-holdings:sports'],
    queryFn: async () => {
      const [acc, picks, bets, bankroll] = await Promise.all([
        (supabase as any).from('sbo_accuracy_log').select('accuracy_pct, total_predictions, correct_predictions, date').order('date', { ascending: false }).limit(30),
        (supabase as any).from('sbo_saved_picks').select('id', { count: 'exact', head: true }),
        (supabase as any).from('sbo_actual_bets').select('id', { count: 'exact', head: true }),
        (supabase as any).from('sbo_bankroll').select('id', { count: 'exact', head: true }),
      ]);
      const rows = acc.data || [];
      const totalPreds = rows.reduce((s: number, r: any) => s + (r.total_predictions || 0), 0);
      const totalCorrect = rows.reduce((s: number, r: any) => s + (r.correct_predictions || 0), 0);
      const rolling = totalPreds > 0 ? (totalCorrect / totalPreds) * 100 : null;
      return {
        rollingAccuracy: rolling,
        sampleSize: totalPreds,
        savedPicks: picks.count || 0,
        bets: bets.count || 0,
        bankrollSeeded: (bankroll.count || 0) > 0,
      };
    },
  });

  // ── REAL ESTATE: live-thin ───────────────────────────────────────────────
  const re = useQuery({
    queryKey: ['owner-holdings:re'],
    queryFn: async () => {
      const [deals, leads, buyers] = await Promise.all([
        (supabase as any).from('re_deals').select('id', { count: 'exact', head: true }),
        (supabase as any).from('re_leads').select('id', { count: 'exact', head: true }),
        (supabase as any).from('re_buyers').select('id', { count: 'exact', head: true }),
      ]);
      return { deals: deals.count || 0, leads: leads.count || 0, buyers: buyers.count || 0 };
    },
  });

  // ── BUSINESS ACCOUNTING: rollup count from revenue_events ────────────────
  const accounting = useQuery({
    queryKey: ['owner-holdings:accounting'],
    queryFn: async () => {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from('revenue_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth.toISOString());
      return { mtdEvents: count || 0 };
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
            <Building className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Investment Command</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Each card is a doorway into an investment class. Numbers are live or honestly pending — never fabricated.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 w-fit">
          <TrendingUp className="h-3 w-3 mr-1" />
          Honest-data mode
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* ── SPORTS (LIVE) ─────────────────────────────────────────── */}
        <Card
          className="rounded-xl border-green-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/sports')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-green-400" />
                <CardTitle className="text-base">Sports Betting AI</CardTitle>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">LIVE</Badge>
            </div>
            <CardDescription className="text-xs">Model accuracy & pick volume from SBO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Rolling accuracy (30d)" value={
              sports.data?.rollingAccuracy === null
                ? '—'
                : sports.data
                  ? `${sports.data.rollingAccuracy?.toFixed(1)}% (${sports.data.sampleSize} preds)`
                  : '…'
            } />
            <Row label="Saved picks" value={sports.data ? sports.data.savedPicks.toLocaleString() : '…'} />
            <Row label="Bets logged" value={sports.data ? sports.data.bets.toLocaleString() : '…'} />
            <div className="pt-2 border-t border-border/50">
              {sports.data?.bankrollSeeded ? (
                <span className="text-xs text-emerald-400">Bankroll seeded ✓</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Not seeded — log first bet to activate bankroll/record</span>
              )}
            </div>
            <div className="flex items-center justify-end text-xs text-muted-foreground"><ChevronRight className="h-3 w-3" /></div>
          </CardContent>
        </Card>

        {/* ── REAL ESTATE (LIVE-THIN) ───────────────────────────────── */}
        <Card
          className="rounded-xl border-emerald-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/real-estate')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-base">Real Estate OS</CardTitle>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">LIVE</Badge>
            </div>
            <CardDescription className="text-xs">Deal flow, leads, buyer book</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Deals" value={re.data ? re.data.deals.toLocaleString() : '…'} />
            <Row label="Leads" value={re.data ? re.data.leads.toLocaleString() : '…'} />
            <Row label="Buyers" value={re.data ? re.data.buyers.toLocaleString() : '…'} />
            {re.data && re.data.deals === 0 && (
              <div className="pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground italic">Pipeline empty — add deals in the RE OS.</span>
              </div>
            )}
            <div className="flex items-center justify-end text-xs text-muted-foreground"><ChevronRight className="h-3 w-3" /></div>
          </CardContent>
        </Card>

        {/* ── BUSINESS ACCOUNTING ROLLUP ────────────────────────────── */}
        <Card
          className="rounded-xl border-blue-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/accounting')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-base">Business Accounting</CardTitle>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">ROLLUP</Badge>
            </div>
            <CardDescription className="text-xs">Operations revenue feeds the empire ledger</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Revenue events MTD" value={accounting.data ? accounting.data.mtdEvents.toLocaleString() : '…'} />
            <div className="pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Open Accounting OS for P&amp;L, invoices, AR.</span>
            </div>
            <div className="flex items-center justify-end text-xs text-muted-foreground"><ChevronRight className="h-3 w-3" /></div>
          </CardContent>
        </Card>

        {/* ── INVESTMENT ENGINE — IN DESIGN (Stocks / Notes) ────────── */}
        <Card className="rounded-xl border-purple-500/30 opacity-90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base">Dynasty Investment Engine</CardTitle>
              </div>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]">IN DESIGN</Badge>
            </div>
            <CardDescription className="text-xs">Stocks · Mortgage notes · Private deal flow</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Hub specification queued for Round 2. No data sources connected yet — placeholder by design (no fake numbers).
            </p>
          </CardContent>
        </Card>

        {/* ── CRYPTO / AUTO-TRADING — EXTERNAL PLATFORM PENDING ─────── */}
        <Card
          className="rounded-xl border-orange-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/crypto')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-orange-400" />
                <CardTitle className="text-base">Crypto Hub</CardTitle>
              </div>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px]">PLANNED</Badge>
            </div>
            <CardDescription className="text-xs">External platform — connection pending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Awaiting platform link from David. Deep-link vs embed vs read-bridge decided on arrival.</p>
            <div className="flex items-center justify-end text-xs text-muted-foreground"><Settings2 className="h-3 w-3 mr-1" /> Paste link in card →</div>
          </CardContent>
        </Card>

        <Card
          className="rounded-xl border-cyan-500/30 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/os/owner/holdings/auto-trading')}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-cyan-400" />
                <CardTitle className="text-base">Auto-Trading AI</CardTitle>
              </div>
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">PLANNED</Badge>
            </div>
            <CardDescription className="text-xs">Bundled with Crypto Hub external link</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bot performance, strategy config, and live monitoring activate once the external trading platform is connected.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="pt-6 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-400 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Honest empty states by law.</span> Cards never show fabricated portfolio values.
            As real data flows in (bets logged, deals closed, platform linked), each card upgrades itself automatically.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
