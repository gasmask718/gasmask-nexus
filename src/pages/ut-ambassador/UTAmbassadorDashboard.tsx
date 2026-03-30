import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Users, MousePointerClick,
  Copy, ExternalLink, LogOut, Loader2, Star,
  Eye, Target, Zap, Award, AlertTriangle,
  ArrowUpRight, Clock, CheckCircle2, Lightbulb,
  BarChart3, Gift, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';

const TIER_CONFIG: Record<string, { label: string; emoji: string; color: string; border: string; bg: string }> = {
  legend:  { label: 'Legend',      emoji: '👑', color: 'text-amber-400',  border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  elite:   { label: 'Elite',       emoji: '💎', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  rising:  { label: 'Rising Star', emoji: '🚀', color: 'text-cyan-400',   border: 'border-cyan-500/30',   bg: 'bg-cyan-500/10' },
  starter: { label: 'Starter',     emoji: '🌱', color: 'text-emerald-400',border: 'border-emerald-500/30',bg: 'bg-emerald-500/10' },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active:    { label: 'Active',    variant: 'default' },
  pending:   { label: 'Pending',   variant: 'outline' },
  suspended: { label: 'Suspended', variant: 'destructive' },
};

export default function UTAmbassadorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ambassador, setAmbassador] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [payouts, setPayout] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [notApproved, setNotApproved] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/ambassador/login'); return; }

      // Fetch ambassador record
      let { data: amb } = await supabase
        .from('unforgettable_ambassadors' as any)
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!amb) {
        const { data: ambByEmail } = await supabase
          .from('unforgettable_ambassadors' as any)
          .select('*')
          .eq('email', user.email)
          .maybeSingle();
        amb = ambByEmail;
      }

      if (!amb) { setNotApproved(true); setLoading(false); return; }
      if (amb.status !== 'active') { setNotApproved(true); setAmbassador(amb); setLoading(false); return; }

      setAmbassador(amb);

      // Fetch referrals, payouts, insights in parallel
      const [refRes, payRes, insRes] = await Promise.all([
        supabase.from('ut_ambassador_referrals' as any).select('*').eq('ambassador_id', amb.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('ut_ambassador_payouts' as any).select('*').eq('ambassador_id', amb.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('ut_ambassador_insights' as any).select('*').eq('ambassador_id', amb.id).eq('is_resolved', false).order('created_at', { ascending: false }).limit(5),
      ]);

      setReferrals(refRes.data || []);
      setPayout(payRes.data || []);
      setInsights(insRes.data || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/ambassador/login');
  };

  const copyReferralLink = () => {
    const link = `https://unforgettabletimesusa.com?ref=${ambassador?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Account Under Review</CardTitle>
            <CardDescription>
              {ambassador?.status === 'suspended'
                ? 'Your account has been suspended. Contact support for help.'
                : 'Your ambassador application is being reviewed. You\'ll receive an email once approved.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = TIER_CONFIG[ambassador?.performance_tier || ambassador?.tier || 'starter'] || TIER_CONFIG.starter;
  const status = STATUS_CONFIG[ambassador?.status || 'pending'] || STATUS_CONFIG.pending;
  const paidTotal = payouts.filter(p => p.payout_status === 'paid').reduce((s: number, p: any) => s + Number(p.commission_amount || 0), 0);
  const availableBalance = Number(ambassador?.total_commissions || 0) - paidTotal;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
              Unforgettable Times
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {ambassador?.full_name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome + Tier */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {ambassador?.full_name?.split(' ')[0]} 👋</h1>
            <p className="text-muted-foreground text-sm">Here's your performance overview</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${tier.border} ${tier.bg}`}>
            <span className="text-xl">{tier.emoji}</span>
            <div>
              <div className={`font-semibold ${tier.color}`}>{tier.label}</div>
              <div className="text-xs text-muted-foreground">{ambassador?.commission_rate || 15}% commission</div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} label="Total Earnings" value={`$${Number(ambassador?.total_commissions || 0).toLocaleString()}`} accent="text-emerald-400" bg="bg-emerald-500/10" sub={`$${availableBalance.toLocaleString()} available`} />
          <KPICard icon={TrendingUp} label="Revenue Generated" value={`$${Number(ambassador?.total_revenue || 0).toLocaleString()}`} accent="text-blue-400" bg="bg-blue-500/10" sub={`${ambassador?.total_conversions || 0} conversions`} />
          <KPICard icon={Users} label="Total Referrals" value={ambassador?.total_referrals || 0} accent="text-purple-400" bg="bg-purple-500/10" sub={`${ambassador?.total_leads || 0} leads`} />
          <KPICard icon={Target} label="Conversion Rate" value={`${Number(ambassador?.conversion_rate || 0).toFixed(1)}%`} accent="text-amber-400" bg="bg-amber-500/10" sub={`${ambassador?.total_clicks || 0} clicks`} />
        </div>

        {/* Referral Link */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Your Referral Link</span>
                </div>
                <code className="text-xs sm:text-sm bg-background/60 px-3 py-1.5 rounded-lg block truncate border">
                  https://unforgettabletimesusa.com?ref={ambassador?.referral_code}
                </code>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={copyReferralLink}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://unforgettabletimesusa.com?ref=${ambassador?.referral_code}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Clicks" value={ambassador?.total_clicks || 0} icon={MousePointerClick} />
          <StatCard label="Leads" value={ambassador?.total_leads || 0} icon={Eye} />
          <StatCard label="Conversions" value={ambassador?.total_conversions || 0} icon={CheckCircle2} />
          <StatCard label="Avg Revenue" value={`$${Number(ambassador?.avg_revenue_per_conversion || 0).toFixed(0)}`} icon={BarChart3} />
          <StatCard label="Rev/Click" value={`$${Number(ambassador?.revenue_per_click || 0).toFixed(2)}`} icon={ArrowUpRight} />
          <StatCard label="Earn/Click" value={`$${Number(ambassador?.earnings_per_click || 0).toFixed(2)}`} icon={DollarSign} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {referrals.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No referrals yet. Share your link to get started!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell>
                            <ReferralStatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {r.revenue_amount ? `$${Number(r.revenue_amount).toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium text-emerald-400">
                            {r.commission_amount ? `$${Number(r.commission_amount).toLocaleString()}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Payouts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-400" /> Payouts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-sm font-medium">Available Balance</span>
                  <span className="text-lg font-bold text-emerald-400">${availableBalance.toLocaleString()}</span>
                </div>
                {payouts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No payouts yet</p>
                ) : (
                  payouts.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">${Number(p.commission_amount || 0).toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {p.created_at ? format(new Date(p.created_at), 'MMM d') : ''}
                        </span>
                      </div>
                      <Badge variant={p.payout_status === 'paid' ? 'default' : 'outline'} className="text-xs">
                        {p.payout_status || 'pending'}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* AI Insights */}
            {insights.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-400" /> Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {insights.map((ins: any) => (
                    <div key={ins.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      <InsightIcon type={ins.insight_type} />
                      <p className="text-xs">{ins.insight_text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Tips */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400" /> Earn More
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <Tip text="Share your link on social media for wider reach" />
                <Tip text="Focus on quality leads — conversions earn you more" />
                <Tip text="Consistent activity keeps your tier and commission high" />
                <Tip text="Top performers get boosted rates and VIP recognition" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */

function KPICard({ icon: Icon, label, value, accent, bg, sub }: { icon: any; label: string; value: any; accent: string; bg: string; sub?: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 ${accent} mb-1`}>
          <div className={`p-1.5 rounded-lg ${bg}`}><Icon className="h-4 w-4" /></div>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <div className="p-3 rounded-lg border bg-card text-center">
      <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ReferralStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    click: { label: 'Click', variant: 'outline' },
    lead: { label: 'Lead', variant: 'secondary' },
    converted: { label: 'Converted', variant: 'default' },
  };
  const s = map[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
}

function InsightIcon({ type }: { type: string }) {
  if (type === 'risk' || type === 'warning') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />;
  if (type === 'boost' || type === 'achievement') return <Award className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />;
  return <Star className="h-4 w-4 text-primary shrink-0 mt-0.5" />;
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
