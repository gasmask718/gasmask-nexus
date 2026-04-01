import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BarChart3, TrendingUp, Users, DollarSign, Target, Zap, Download, Copy, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const TIERS = ['starter', 'silver', 'gold', 'platinum', 'legend'] as const;
type Tier = typeof TIERS[number];
const TIER_RATES: Record<Tier, number> = { starter: 10, silver: 12, gold: 15, platinum: 17, legend: 20 };
const TIER_ICONS: Record<Tier, string> = { starter: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', legend: '👑' };
const TIER_COLORS: Record<Tier, string> = { starter: 'text-orange-400', silver: 'text-gray-300', gold: 'text-yellow-400', platinum: 'text-cyan-400', legend: 'text-purple-400' };

interface SimInputs {
  totalAmbassadors: number;
  avgBookingValue: number;
  bookingsPerTier: Record<Tier, number>;
  tierDist: Record<Tier, number>;
  vendorCostPct: number;
}

const DEFAULT_INPUTS: SimInputs = {
  totalAmbassadors: 1000,
  avgBookingValue: 3500,
  bookingsPerTier: { starter: 2, silver: 8, gold: 20, platinum: 35, legend: 60 },
  tierDist: { starter: 70, silver: 20, gold: 7, platinum: 2, legend: 1 },
  vendorCostPct: 57,
};

const PRESETS: { label: string; count: number }[] = [
  { label: '📊 500 Ambassadors', count: 500 },
  { label: '📊 1,000 Ambassadors', count: 1000 },
  { label: '📊 5,000 Ambassadors', count: 5000 },
  { label: '📊 10,000 Ambassadors', count: 10000 },
];

function fmt(n: number) {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function simulate(inputs: SimInputs) {
  const tierBreakdown: { tier: Tier; count: number; bookings: number; revenue: number; commission: number }[] = [];
  let totalBookings = 0, totalRevenue = 0, totalCommissions = 0;

  for (const tier of TIERS) {
    const count = Math.round(inputs.totalAmbassadors * (inputs.tierDist[tier] / 100));
    const bookings = count * inputs.bookingsPerTier[tier];
    const revenue = bookings * inputs.avgBookingValue;
    const commission = revenue * (TIER_RATES[tier] / 100);
    totalBookings += bookings;
    totalRevenue += revenue;
    totalCommissions += commission;
    tierBreakdown.push({ tier, count, bookings, revenue, commission });
  }

  const vendorCosts = totalRevenue * (inputs.vendorCostPct / 100);
  const grossProfit = totalRevenue - vendorCosts;
  const netProfit = grossProfit - totalCommissions;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const avgRate = totalRevenue > 0 ? (totalCommissions / totalRevenue) * 100 : 0;

  return { tierBreakdown, totalBookings, totalRevenue, vendorCosts, grossProfit, totalCommissions, netProfit, netMarginPct, annualNetProfit: netProfit * 12, annualRevenue: totalRevenue * 12, avgRate };
}

export default function UTGrowthSimulator() {
  const [inputs, setInputs] = useState<SimInputs>(DEFAULT_INPUTS);

  const update = useCallback(<K extends keyof SimInputs>(key: K, val: SimInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: val }));
  }, []);

  const updateTierDist = useCallback((tier: Tier, val: number) => {
    setInputs(prev => ({ ...prev, tierDist: { ...prev.tierDist, [tier]: val } }));
  }, []);

  const updateBookings = useCallback((tier: Tier, val: number) => {
    setInputs(prev => ({ ...prev, bookingsPerTier: { ...prev.bookingsPerTier, [tier]: val } }));
  }, []);

  const result = useMemo(() => simulate(inputs), [inputs]);
  const distTotal = useMemo(() => Object.values(inputs.tierDist).reduce((a, b) => a + b, 0), [inputs.tierDist]);

  // All 4 presets side by side
  const comparisons = useMemo(() => PRESETS.map(p => simulate({ ...inputs, totalAmbassadors: p.count })), [inputs]);

  // Worst case: all legend
  const worstCase = useMemo(() => simulate({ ...inputs, tierDist: { starter: 0, silver: 0, gold: 0, platinum: 0, legend: 100 } }), [inputs]);

  // Growth timeline
  const timeline = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const ambs = Math.round((inputs.totalAmbassadors / 12) * month);
    const r = simulate({ ...inputs, totalAmbassadors: ambs });
    return { month, ambassadors: ambs, revenue: r.totalRevenue, netProfit: r.netProfit, cumProfit: 0 };
  }).reduce((acc, item) => {
    const prev = acc.length ? acc[acc.length - 1].cumProfit : 0;
    item.cumProfit = prev + item.netProfit;
    acc.push(item);
    return acc;
  }, [] as { month: number; ambassadors: number; revenue: number; netProfit: number; cumProfit: number }[]), [inputs]);

  const breakEvenMonth = timeline.findIndex(m => m.netProfit > 0) + 1 || 'N/A';
  const first1MMonth = timeline.findIndex(m => m.netProfit >= 1e6) + 1 || 'N/A';
  const first10MMonth = timeline.findIndex(m => m.netProfit >= 1e7) + 1 || 'N/A';

  const maxCommRate = useMemo(() => {
    if (result.totalRevenue === 0) return 0;
    const grossMarginPct = (result.grossProfit / result.totalRevenue) * 100;
    return grossMarginPct;
  }, [result]);

  const copySummary = () => {
    const text = `Unforgettable Times Growth Simulation\nDate: ${new Date().toLocaleDateString()}\nAmbassadors: ${inputs.totalAmbassadors.toLocaleString()}\nMonthly Revenue: ${fmtFull(result.totalRevenue)}\nNet Profit/Month: ${fmtFull(result.netProfit)}\nNet Profit/Year: ${fmtFull(result.annualNetProfit)}\nNet Margin: ${result.netMarginPct.toFixed(1)}%`;
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">📊 Ambassador Growth Simulator</h1>
        <p className="text-muted-foreground">Model your revenue at any scale — 500 to 10,000 ambassadors</p>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <Button key={p.count} variant={inputs.totalAmbassadors === p.count ? 'default' : 'outline'} size="sm" onClick={() => update('totalAmbassadors', p.count)}>
            {p.label}
          </Button>
        ))}
      </div>

      {/* Section 1 - Controls */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Simulation Inputs</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Total Ambassadors: {inputs.totalAmbassadors.toLocaleString()}</Label>
              <Slider min={100} max={10000} step={100} value={[inputs.totalAmbassadors]} onValueChange={([v]) => update('totalAmbassadors', v)} />
            </div>
            <div className="space-y-2">
              <Label>Avg Booking Value: {fmtFull(inputs.avgBookingValue)}</Label>
              <Slider min={500} max={10000} step={100} value={[inputs.avgBookingValue]} onValueChange={([v]) => update('avgBookingValue', v)} />
            </div>
            <div className="space-y-2">
              <Label>Your Vendor Cost %: {inputs.vendorCostPct}%</Label>
              <Slider min={40} max={70} step={1} value={[inputs.vendorCostPct]} onValueChange={([v]) => update('vendorCostPct', v)} />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {TIERS.map(tier => (
              <div key={tier} className="space-y-2">
                <Label className={`text-xs font-semibold uppercase ${TIER_COLORS[tier]}`}>{TIER_ICONS[tier]} {tier}</Label>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Bookings/mo</Label>
                  <Input type="number" min={0} value={inputs.bookingsPerTier[tier]} onChange={e => updateBookings(tier, Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Distribution %</Label>
                  <Input type="number" min={0} max={100} value={inputs.tierDist[tier]} onChange={e => updateTierDist(tier, Number(e.target.value))} className="h-8 text-sm" />
                </div>
              </div>
            ))}
          </div>
          {distTotal !== 100 && <p className="text-sm text-destructive font-medium">⚠️ Distribution totals {distTotal}% — must equal 100%</p>}
        </CardContent>
      </Card>

      {/* Section 2 - Tier Breakdown Table */}
      <Card>
        <CardHeader><CardTitle>Tier Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground">Tier</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Count</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Rate</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Bookings/mo</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Revenue/mo</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Commission/mo</th>
                </tr>
              </thead>
              <tbody>
                {result.tierBreakdown.map(t => (
                  <tr key={t.tier} className="border-b border-border/50">
                    <td className={`py-2 px-3 font-medium ${TIER_COLORS[t.tier]}`}>{TIER_ICONS[t.tier]} {t.tier.charAt(0).toUpperCase() + t.tier.slice(1)}</td>
                    <td className="text-right py-2 px-3">{t.count.toLocaleString()}</td>
                    <td className="text-right py-2 px-3">{TIER_RATES[t.tier]}%</td>
                    <td className="text-right py-2 px-3">{t.bookings.toLocaleString()}</td>
                    <td className="text-right py-2 px-3">{fmt(t.revenue)}</td>
                    <td className="text-right py-2 px-3">{fmt(t.commission)}</td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2 border-primary">
                  <td className="py-2 px-3">TOTAL</td>
                  <td className="text-right py-2 px-3">{inputs.totalAmbassadors.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">avg {result.avgRate.toFixed(1)}%</td>
                  <td className="text-right py-2 px-3">{result.totalBookings.toLocaleString()}</td>
                  <td className="text-right py-2 px-3">{fmt(result.totalRevenue)}</td>
                  <td className="text-right py-2 px-3">{fmt(result.totalCommissions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3 - Revenue Waterfall */}
      <Card>
        <CardHeader><CardTitle>Revenue Waterfall (Monthly)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: 'GROSS REVENUE', value: result.totalRevenue, color: 'text-foreground', prefix: '' },
            { label: `minus VENDOR COSTS (${inputs.vendorCostPct}%)`, value: result.vendorCosts, color: 'text-red-400', prefix: '−' },
            { label: `= GROSS PROFIT (${((result.grossProfit / (result.totalRevenue || 1)) * 100).toFixed(0)}%)`, value: result.grossProfit, color: 'text-yellow-400', prefix: '' },
            { label: 'minus AMBASSADOR COMMISSIONS', value: result.totalCommissions, color: 'text-orange-400', prefix: '−' },
            { label: `= NET PROFIT (${result.netMarginPct.toFixed(0)}%)`, value: result.netProfit, color: result.netProfit >= 0 ? 'text-green-400' : 'text-red-500', prefix: '' },
          ].map((row, i) => (
            <div key={i}>
              {(i === 2 || i === 4) && <Separator className="my-2" />}
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${row.color}`}>{row.label}</span>
                <span className={`text-2xl font-bold ${row.color}`}>{row.prefix}{fmt(row.value)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 5 - KPI Dashboard */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Results Dashboard</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Ambassadors', value: inputs.totalAmbassadors.toLocaleString(), icon: Users },
            { label: 'Monthly Bookings', value: result.totalBookings.toLocaleString(), icon: Target },
            { label: 'Annual Bookings', value: (result.totalBookings * 12).toLocaleString(), icon: Target },
            { label: 'Avg Bookings/Amb', value: (result.totalBookings / (inputs.totalAmbassadors || 1)).toFixed(1), icon: BarChart3 },
            { label: 'Monthly Revenue', value: fmt(result.totalRevenue), icon: DollarSign },
            { label: 'Annual Revenue', value: fmt(result.annualRevenue), icon: DollarSign },
            { label: 'Vendor Costs/mo', value: fmt(result.vendorCosts), icon: DollarSign },
            { label: 'Gross Profit/mo', value: fmt(result.grossProfit), icon: TrendingUp },
            { label: 'Total Comm/mo', value: fmt(result.totalCommissions), icon: DollarSign },
            { label: 'NET PROFIT/mo', value: fmt(result.netProfit), icon: TrendingUp, highlight: true },
            { label: 'NET PROFIT/yr', value: fmt(result.annualNetProfit), icon: TrendingUp, highlight: true },
            { label: 'Net Margin', value: `${result.netMarginPct.toFixed(1)}%`, icon: BarChart3 },
          ].map((kpi, i) => (
            <Card key={i} className={(kpi as any).highlight ? (result.netProfit >= 0 ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : ''}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <kpi.icon className="h-3 w-3" />
                  {kpi.label}
                </div>
                <div className="text-lg font-bold text-foreground">
                  {kpi.value} {(kpi as any).highlight && (result.netProfit >= 0 ? '✅' : '❌')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section 6 - Growth Timeline */}
      <Card>
        <CardHeader><CardTitle>12-Month Growth Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground">Month</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Ambassadors</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Monthly Revenue</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Net Profit</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Cumulative Profit</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map(m => (
                  <tr key={m.month} className={`border-b border-border/50 ${m.netProfit >= 1e5 ? 'bg-yellow-500/5' : m.netProfit >= 1e4 ? 'bg-green-500/5' : 'bg-amber-500/5'}`}>
                    <td className="py-2 px-3 font-medium">Month {m.month}</td>
                    <td className="text-right py-2 px-3">{m.ambassadors.toLocaleString()}</td>
                    <td className="text-right py-2 px-3">{fmt(m.revenue)}</td>
                    <td className="text-right py-2 px-3">{fmt(m.netProfit)}</td>
                    <td className="text-right py-2 px-3">{fmt(m.cumProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Badge variant="outline">Break-even month: {breakEvenMonth}</Badge>
            <Badge variant="outline">First $1M month: {first1MMonth}</Badge>
            <Badge variant="outline">First $10M month: {first10MMonth}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Section 7 - Commission Risk Analysis */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Commission Risk Analysis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-semibold text-foreground">What if all ambassadors were Legend tier?</p>
              <p className="text-sm text-muted-foreground">Current commission: {fmt(result.totalCommissions)}/mo</p>
              <p className="text-sm text-muted-foreground">If all Legend (20%): {fmt(worstCase.totalCommissions)}/mo</p>
              <p className="text-sm text-muted-foreground">Additional cost: {fmt(worstCase.totalCommissions - result.totalCommissions)}/mo</p>
              <div className="flex items-center gap-1">
                {worstCase.netProfit >= 0 ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className={`text-sm font-medium ${worstCase.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {worstCase.netProfit >= 0 ? 'Still profitable' : 'NOT profitable'}
                </span>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-semibold text-foreground">Minimum profitable commission rate</p>
              <p className="text-sm text-muted-foreground">Max rate before loss: {maxCommRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">Your Legend rate: 20%</p>
              <p className="text-sm text-muted-foreground">Safety buffer: {(maxCommRate - 20).toFixed(1)}%</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-semibold text-foreground">Break-even analysis</p>
              <p className="text-sm text-muted-foreground">Min bookings/mo to cover commissions: {result.totalRevenue > 0 ? Math.ceil(result.totalCommissions / inputs.avgBookingValue).toLocaleString() : '0'}</p>
              <p className="text-sm text-muted-foreground">Current simulation: {result.totalBookings.toLocaleString()} bookings</p>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Well above minimum</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 8 - Comparison Table */}
      <Card>
        <CardHeader><CardTitle>Scenario Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground">Metric</th>
                  {PRESETS.map(p => (
                    <th key={p.count} className={`text-right py-2 px-3 ${inputs.totalAmbassadors === p.count ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {p.count.toLocaleString()} Ambs
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Monthly Bookings', key: 'totalBookings', format: (n: number) => n.toLocaleString() },
                  { label: 'Gross Revenue/mo', key: 'totalRevenue', format: fmt },
                  { label: 'Vendor Costs/mo', key: 'vendorCosts', format: fmt },
                  { label: 'Gross Profit/mo', key: 'grossProfit', format: fmt },
                  { label: 'Commissions/mo', key: 'totalCommissions', format: fmt },
                  { label: 'NET PROFIT/mo', key: 'netProfit', format: fmt },
                  { label: 'NET PROFIT/yr', key: 'annualNetProfit', format: fmt },
                  { label: 'Net Margin', key: 'netMarginPct', format: (n: number) => `${n.toFixed(1)}%` },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium text-foreground">{row.label}</td>
                    {comparisons.map((c, i) => (
                      <td key={i} className={`text-right py-2 px-3 ${inputs.totalAmbassadors === PRESETS[i].count ? 'text-primary font-bold bg-primary/5' : ''}`}>
                        {row.format((c as any)[row.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 9 - Fast Track Program */}
      <Card className="border-purple-500/30">
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-purple-400" /> Fast Track Legend Program</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Standard path to Legend:</p>
                <p className="text-sm text-muted-foreground">50 conversions → ~18 months avg</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Fast Track path:</p>
                <p className="text-sm text-muted-foreground">50 conversions in 6 months = 8+ bookings/month minimum</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Who qualifies:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  <li>Influencers 500K+ followers</li>
                  <li>Corporate partners / agencies</li>
                  <li>City captains managing 50+ ambassadors</li>
                </ul>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-semibold text-foreground">Why this protects you:</p>
              <p className="text-sm text-muted-foreground">Only proven performers reach 20%</p>
              <p className="text-sm text-muted-foreground">They've already generated $175K+ in revenue before earning Legend</p>
              <p className="text-sm text-muted-foreground">You've already made $50K+ from them</p>
              <Separator />
              <p className="text-sm font-bold text-green-400">Result: 20% is always EARNED — never given for free</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 10 - Export */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={copySummary}>
          <Copy className="h-4 w-4 mr-2" /> Copy Summary to Clipboard
        </Button>
      </div>
    </div>
  );
}
