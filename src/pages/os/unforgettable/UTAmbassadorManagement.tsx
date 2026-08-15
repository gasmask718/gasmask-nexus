import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, Clock, DollarSign, CheckCircle, XCircle, Search,
  Trophy, TrendingUp, Link2, Activity, Wallet, Copy,
  Eye, ArrowUpRight, Hash, FlaskConical, Loader2,
  Sparkles, AlertTriangle, Zap, Brain, ShieldAlert, Star,
  Gauge, HeartPulse, RefreshCw, Settings, Timer, Shield
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { errText } from "@/lib/errText";

const PINK = '#E91E8C';
const TABLE = 'unforgettable_ambassadors' as const;

const normalizeAmbassadorStatus = (status?: string | null) => {
  const normalized = (status || '').trim().toLowerCase();
  if (!normalized || normalized === 'new' || normalized === 'pending_review') return 'pending';
  if (normalized === 'approved') return 'active';
  if (normalized === 'inactive') return 'suspended';
  return normalized;
};

const getAmbassadorStatusLabel = (status?: string | null) => {
  const raw = (status || '').trim();
  return raw || 'pending';
};

const tierConfig: Record<string, { color: string; icon: string; bg: string }> = {
  legend: { color: 'text-amber-400', icon: '👑', bg: 'bg-amber-500/10 border-amber-500/30' },
  elite: { color: 'text-purple-400', icon: '💎', bg: 'bg-purple-500/10 border-purple-500/30' },
  rising: { color: 'text-blue-400', icon: '🚀', bg: 'bg-blue-500/10 border-blue-500/30' },
  starter: { color: 'text-muted-foreground', icon: '🌱', bg: 'bg-muted/50 border-border' },
};

export default function UTAmbassadorManagement() {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tab, setTab] = useState('ambassadors');

  const [payoutDialog, setPayoutDialog] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<any>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');

  const [detailAmb, setDetailAmb] = useState<any>(null);

  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);

  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [monitorRunning, setMonitorRunning] = useState(false);

  const [insights, setInsights] = useState<any[]>([]);
  const [insightsRunning, setInsightsRunning] = useState(false);

  // Autonomous ops data
  const [opsLogs, setOpsLogs] = useState<any[]>([]);
  const [alertConfig, setAlertConfig] = useState<any>(null);
  const [optimizerRunning, setOptimizerRunning] = useState(false);

  const fetchAll = async () => {
    console.log('[UT Ambassador] Fetching all records from', TABLE);
    try {
      const ambRes = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
      console.log('[UT Ambassador] Query result:', { count: ambRes.data?.length, error: ambRes.error });
      if (ambRes.error) console.error('[UT Ambassador] Query error:', ambRes.error);
      if (ambRes.data) setAmbassadors(ambRes.data);
    } catch (err) {
      console.error('[UT Ambassador] Fetch exception:', errText(err));
    }

    // Fetch supporting tables (may not exist yet, ignore errors)
    try {
      const [refRes, payRes, healthRes, insightRes, opsRes, configRes] = await Promise.all([
        (supabase as any).from('ut_ambassador_referrals').select('*').order('created_at', { ascending: false }).limit(200),
        (supabase as any).from('ut_ambassador_payouts').select('*, unforgettable_ambassadors(full_name)').order('created_at', { ascending: false }),
        (supabase as any).from('pipeline_health_logs').select('*').order('created_at', { ascending: false }).limit(50),
        (supabase as any).from('ut_ambassador_insights').select('*').is('dismissed_at', null).order('created_at', { ascending: false }).limit(50),
        (supabase as any).from('system_operation_logs').select('*').eq('system_name', 'ut_ambassador_pipeline').order('created_at', { ascending: false }).limit(30),
        (supabase as any).from('system_alert_config').select('*').eq('system_name', 'ut_ambassador_pipeline').maybeSingle(),
      ]);
      if (refRes.data) setReferrals(refRes.data);
      if (payRes.data) setPayouts(payRes.data);
      if (healthRes.data) setHealthLogs(healthRes.data);
      if (insightRes.data) setInsights(insightRes.data);
      if (opsRes.data) setOpsLogs(opsRes.data);
      if (configRes.data) setAlertConfig(configRes.data);
    } catch (err) {
      console.warn('[UT Ambassador] Supporting tables fetch error (non-critical):', errText(err));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('ut-amb-engine')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_ambassador_referrals' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_ambassador_payouts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_health_logs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_operation_logs' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = ambassadors.filter(a => {
    const normalizedStatus = normalizeAmbassadorStatus(a.status);
    if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.full_name || '').toLowerCase().includes(q)
        || (a.email || '').toLowerCase().includes(q)
        || (a.referral_code || '').toLowerCase().includes(q);
    }
    return true;
  });

  // KPIs
  const pendingCount = ambassadors.filter(a => normalizeAmbassadorStatus(a.status) === 'pending').length;
  const activeCount = ambassadors.filter(a => normalizeAmbassadorStatus(a.status) === 'active').length;
  const totalRevenue = ambassadors.reduce((s, a) => s + Number(a.total_revenue || 0), 0);
  const totalCommissions = ambassadors.reduce((s, a) => s + Number(a.total_commissions || 0), 0);
  const totalReferralClicks = referrals.length;
  const totalConversions = referrals.filter(r => r.status === 'converted').length;
  const boostedCount = ambassadors.filter(a => a.is_boosted).length;
  const riskCount = ambassadors.filter(a => a.risk_level === 'high' || a.risk_level === 'medium').length;

  // Autonomous Ops metrics
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentHealth = healthLogs.filter(l => new Date(l.created_at) > now24h);
  const failuresLast24h = recentHealth.filter(l => !l.success).length;
  const alertsSentToday = recentHealth.filter(l => l.alert_sent).length;
  const autoHealsToday = recentHealth.reduce((s, l) => s + (l.auto_heal_count || 0), 0);
  const lastHealthCheck = healthLogs[0];
  const lastDeepTest = healthLogs.find(l => l.check_type === 'deep_test');
  const lastOptRun = opsLogs.find(l => l.operation_type === 'daily_optimization');
  const pipelineHealthy = lastHealthCheck?.success !== false;

  const leaderboard = useMemo(() =>
    [...ambassadors]
      .filter(a => normalizeAmbassadorStatus(a.status) === 'active')
      .sort((a, b) => Number(b.total_revenue || 0) - Number(a.total_revenue || 0))
      .slice(0, 20),
    [ambassadors]
  );

  const handleApprove = async (amb: any) => {
    setApproving(amb.id);
    try {
      const refLink = `https://unforgettabletimesusa.com?ref=${amb.referral_code}`;
      const { error } = await supabase
        .from(TABLE)
        .update({ status: 'active', approved_at: new Date().toISOString(), active_referral_link: refLink })
        .eq('id', amb.id);
      if (error) throw error;

      // Create auth user + send password setup email
      try {
        const { data: authResult, error: authErr } = await supabase.functions.invoke('approve-ut-ambassador', {
          body: { ambassador_id: amb.id },
        });
        if (authErr) console.error('Auth user creation failed:', authErr);
        else if (authResult?.success) {
          toast.success(`Auth account created — password setup email sent to ${amb.email}`);
        }
      } catch (e) {
        console.error('Auth user creation error:', errText(e));
      }

      // Send SMS notification
      try {
        await supabase.functions.invoke('ambassador-notify', {
          body: { event: 'approved', ambassador_id: amb.id, referral_code: amb.referral_code, name: amb.full_name, phone: amb.phone },
        });
      } catch {}
      toast.success(`${amb.full_name} approved!`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApproving(null);
    }
  };

  const handleSuspend = async (amb: any) => {
    const { error } = await supabase.from(TABLE).update({ status: 'suspended' }).eq('id', amb.id);
    if (error) { toast.error('Failed to suspend'); return; }
    toast.success(`${amb.full_name} suspended`);
    fetchAll();
  };

  const handleCreatePayout = async () => {
    if (!payoutTarget || !payoutAmount) return;
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Invalid amount'); return; }
    const { error } = await (supabase as any).from('ut_ambassador_payouts').insert({
      ambassador_id: payoutTarget.id,
      commission_amount: amt,
      gross_revenue: payoutTarget.total_revenue || 0,
      payout_method: payoutMethod || null,
      notes: payoutNotes || null,
      payout_status: 'pending',
    });
    if (error) { toast.error('Failed to create payout'); return; }
    toast.success('Payout created');
    setPayoutDialog(false);
    setPayoutAmount('');
    setPayoutNotes('');
    setPayoutMethod('');
    fetchAll();
  };

  const handlePayoutAction = async (payoutId: string, action: 'approved' | 'paid') => {
    const updates: any = { payout_status: action };
    if (action === 'paid') updates.paid_at = new Date().toISOString();
    const { error } = await (supabase as any).from('ut_ambassador_payouts').update(updates).eq('id', payoutId);
    if (error) { toast.error('Failed to update payout'); return; }
    if (action === 'paid') {
      const payout = payouts.find(p => p.id === payoutId);
      if (payout) {
        try {
          await supabase.functions.invoke('ambassador-notify', {
            body: { event: 'payout_paid', ambassador_id: payout.ambassador_id, payout_amount: payout.commission_amount },
          });
        } catch {}
        const amb = ambassadors.find(a => a.id === payout?.ambassador_id);
        if (amb) {
          await supabase.from(TABLE).update({ payout_status: 'paid', last_payout_at: new Date().toISOString() }).eq('id', amb.id);
        }
      }
    }
    toast.success(`Payout marked as ${action}`);
    fetchAll();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const statusColor = (s: string) => {
    const normalized = normalizeAmbassadorStatus(s);
    if (normalized === 'active') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (normalized === 'suspended') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (normalized === 'converted') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (normalized === 'lead') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (normalized === 'clicked') return 'bg-muted text-muted-foreground border-border';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  const payoutStatusColor = (s: string) => {
    if (s === 'paid') return 'bg-green-500/20 text-green-400';
    if (s === 'approved') return 'bg-blue-500/20 text-blue-400';
    return 'bg-amber-500/20 text-amber-400';
  };

  const insightSeverityIcon = (s: string) => {
    if (s === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    if (s === 'success') return <Star className="h-4 w-4 text-green-400" />;
    return <Brain className="h-4 w-4 text-blue-400" />;
  };

  const runPipelineTest = async () => {
    setPipelineRunning(true);
    setPipelineResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('run-ut-ambassador-pipeline-test');
      if (error) throw error;
      setPipelineResult(data);
      if (data?.success) toast.success('Pipeline test passed ✅');
      else toast.error(`Pipeline test failed at: ${data?.failure_point || 'unknown'}`);
    } catch (err: any) {
      setPipelineResult({ success: false, error: err.message });
      toast.error('Pipeline test error');
    } finally {
      setPipelineRunning(false);
    }
  };

  const runMonitor = async () => {
    setMonitorRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('monitor-ut-ambassador-pipeline');
      if (error) throw error;
      if (data?.success) toast.success(`Monitor passed ✅ ${data.auto_healed > 0 ? `(${data.auto_healed} auto-healed)` : ''}`);
      else toast.error(`Monitor failure: ${data?.failure_point || 'unknown'} (severity: ${data?.severity})`);
      fetchAll();
    } catch (err: any) {
      toast.error('Monitor error: ' + err.message);
    } finally {
      setMonitorRunning(false);
    }
  };

  const runOptimizer = async () => {
    setOptimizerRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-ut-ambassador-performance');
      if (error) throw error;
      if (data?.success) {
        toast.success(`Optimizer: ${data.processed} processed, ${data.tier_changes} tier changes, ${data.insights_generated} insights`);
      } else {
        toast.error('Optimizer failed');
      }
      fetchAll();
    } catch (err: any) {
      toast.error('Optimizer error: ' + err.message);
    } finally {
      setOptimizerRunning(false);
    }
  };

  const runInsightsEngine = async () => {
    setInsightsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ut-ambassador-insights');
      if (error) throw error;
      if (data?.success) {
        toast.success(`AI Insights: ${data.insights_generated} generated, ${data.tier_changes} tier changes`);
      } else {
        toast.error('Insights engine failed');
      }
      fetchAll();
    } catch (err: any) {
      toast.error('Insights error: ' + err.message);
    } finally {
      setInsightsRunning(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    await (supabase as any).from('ut_ambassador_insights').update({ dismissed_at: new Date().toISOString() }).eq('id', insightId);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: PINK }}>
            Ambassador Revenue Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Autonomous revenue infrastructure with self-monitoring & AI optimization
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Total Ambassadors: {ambassadors.length} (Pending: {pendingCount} · Active: {activeCount})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchAll(); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={runOptimizer} disabled={optimizerRunning} className="gap-2">
            {optimizerRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
            {optimizerRunning ? 'Optimizing...' : 'Run Optimizer'}
          </Button>
          <Button variant="outline" size="sm" onClick={runInsightsEngine} disabled={insightsRunning} className="gap-2">
            {insightsRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {insightsRunning ? 'Analyzing...' : 'AI Insights'}
          </Button>
          <Button variant="outline" size="sm" onClick={runMonitor} disabled={monitorRunning} className="gap-2">
            {monitorRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartPulse className="h-4 w-4" />}
            {monitorRunning ? 'Checking...' : 'Health Check'}
          </Button>
          <Button variant="outline" size="sm" onClick={runPipelineTest} disabled={pipelineRunning} className="gap-2">
            {pipelineRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {pipelineRunning ? 'Testing...' : 'Deep Test'}
          </Button>
        </div>
      </div>

      {/* Pipeline Test Results */}
      {pipelineResult && (
        <Card className={pipelineResult.success ? 'border-green-500/50' : 'border-destructive/50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {pipelineResult.success ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-destructive" />}
              Pipeline Test — {pipelineResult.success ? 'ALL PASS' : 'FAILURE DETECTED'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
              {pipelineResult.steps && Object.entries(pipelineResult.steps).map(([key, val]: [string, any]) => (
                <div key={key} className={`rounded-md p-2 border ${val.passed ? 'border-green-500/30 bg-green-500/10' : 'border-destructive/30 bg-destructive/10'}`}>
                  <p className="font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className={val.passed ? 'text-green-400' : 'text-destructive'}>{val.passed ? '✅ Pass' : '❌ Fail'}</p>
                  {val.error && <p className="text-destructive/80 mt-1 truncate">{val.error}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Total</span></div>
          <p className="text-2xl font-bold">{ambassadors.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-400" /><span className="text-xs text-muted-foreground">Pending</span></div>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-400" /><span className="text-xs text-muted-foreground">Active</span></div>
          <p className="text-2xl font-bold text-green-400">{activeCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Revenue</span></div>
          <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Commissions</span></div>
          <p className="text-2xl font-bold text-emerald-400">${totalCommissions.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-purple-400" /><span className="text-xs text-muted-foreground">Conversions</span></div>
          <p className="text-2xl font-bold">{totalConversions}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-amber-400" /><span className="text-xs text-muted-foreground">Boosted</span></div>
          <p className="text-2xl font-bold text-amber-400">{boostedCount}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-4 w-4 text-red-400" /><span className="text-xs text-muted-foreground">At Risk</span></div>
          <p className="text-2xl font-bold text-red-400">{riskCount}</p>
        </CardContent></Card>
      </div>

      {/* Debug / Pipeline Visibility Panel */}
      <Card className="border-dashed border-pink-500/40 bg-pink-500/5">
        <CardContent className="pt-4 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-pink-400" />
            <span className="text-muted-foreground">DB Rows:</span>
            <span className="font-bold">{ambassadors.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Showing:</span>
            <span className="font-bold">{filtered.length}</span>
          </div>
          {ambassadors.length > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-muted-foreground">Latest:</span>
              <span className="font-medium">{ambassadors[0]?.full_name}</span>
              <Badge variant="outline" className={statusColor(ambassadors[0]?.status)}>
                {normalizeAmbassadorStatus(ambassadors[0]?.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {ambassadors[0]?.created_at ? formatDistanceToNow(new Date(ambassadors[0].created_at), { addSuffix: true }) : ''}
              </span>
            </div>
          )}
          {ambassadors.length === 0 && !loading && (
            <span className="text-amber-400 font-medium">⚠ No ambassador records in database</span>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 flex-wrap">
          <TabsTrigger value="ambassadors" className="gap-1"><Users className="h-3.5 w-3.5" />Ambassadors</TabsTrigger>
          <TabsTrigger value="ops" className="gap-1"><Gauge className="h-3.5 w-3.5" />Autonomous Ops</TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1"><Trophy className="h-3.5 w-3.5" />Leaderboard</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1"><Brain className="h-3.5 w-3.5" />AI Insights</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1"><Link2 className="h-3.5 w-3.5" />Referrals</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1"><Wallet className="h-3.5 w-3.5" />Payouts</TabsTrigger>
          <TabsTrigger value="health" className="gap-1"><HeartPulse className="h-3.5 w-3.5" />Health Log</TabsTrigger>
        </TabsList>

        {/* ====== AMBASSADORS TAB ====== */}
        <TabsContent value="ambassadors" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name, email, code..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No ambassadors found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Referrals</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Commissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a) => {
                        const normalizedStatus = normalizeAmbassadorStatus(a.status);
                        const statusLabel = getAmbassadorStatusLabel(a.status);
                        const tier = tierConfig[a.performance_tier] || tierConfig.starter;

                        return (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailAmb(a)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {a.is_boosted && <Zap className="h-4 w-4 text-amber-400" />}
                              {(a.risk_level === 'high' || a.risk_level === 'medium') && <ShieldAlert className="h-4 w-4 text-red-400" />}
                              <div>
                                <p className="font-medium">{a.full_name}</p>
                                <p className="text-xs text-muted-foreground">{a.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.referral_code}</code>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); copyToClipboard(a.referral_code); }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${tier.bg} ${tier.color}`}>
                              {tier.icon} {(a.performance_tier || a.tier || 'starter').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{a.commission_rate}%</TableCell>
                          <TableCell>
                            <span className="font-medium">{a.total_converted_referrals || 0}</span>
                            <span className="text-xs text-muted-foreground">/{a.total_referrals || 0}</span>
                          </TableCell>
                          <TableCell className="font-medium">${Number(a.total_revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-emerald-400 font-medium">${Number(a.total_commissions || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={statusColor(statusLabel)}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              {normalizedStatus === 'pending' && (
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(a)} disabled={approving === a.id}>
                                  <CheckCircle className="h-3 w-3 mr-1" />{approving === a.id ? '...' : 'Approve'}
                                </Button>
                              )}
                              {normalizedStatus === 'active' && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPayoutTarget(a); setPayoutDialog(true); }}>
                                    <Wallet className="h-3 w-3 mr-1" />Payout
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleSuspend(a)}>
                                    <XCircle className="h-3 w-3 mr-1" />Suspend
                                  </Button>
                                </>
                              )}
                              {normalizedStatus === 'suspended' && (
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(a)} disabled={approving === a.id}>
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== AUTONOMOUS OPS TAB ====== */}
        <TabsContent value="ops" className="space-y-4">
          {/* Health Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className={pipelineHealthy ? 'border-green-500/30' : 'border-red-500/30'}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <HeartPulse className={`h-4 w-4 ${pipelineHealthy ? 'text-green-400' : 'text-red-400'}`} />
                  <span className="text-xs text-muted-foreground">Pipeline</span>
                </div>
                <Badge className={pipelineHealthy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                  {pipelineHealthy ? '✅ HEALTHY' : '❌ FAILING'}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1"><Timer className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Last Check</span></div>
                <p className="text-sm font-medium">{lastHealthCheck ? formatDistanceToNow(new Date(lastHealthCheck.created_at), { addSuffix: true }) : 'Never'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-amber-400" /><span className="text-xs text-muted-foreground">Failures (24h)</span></div>
                <p className={`text-2xl font-bold ${failuresLast24h > 0 ? 'text-red-400' : 'text-green-400'}`}>{failuresLast24h}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-purple-400" /><span className="text-xs text-muted-foreground">Alerts Sent</span></div>
                <p className="text-2xl font-bold">{alertsSentToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1"><RefreshCw className="h-4 w-4 text-cyan-400" /><span className="text-xs text-muted-foreground">Auto-Heals (24h)</span></div>
                <p className="text-2xl font-bold text-cyan-400">{autoHealsToday}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1"><Gauge className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Last Optimizer</span></div>
                <p className="text-sm font-medium">{lastOptRun ? formatDistanceToNow(new Date(lastOptRun.created_at), { addSuffix: true }) : 'Never'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Scheduler & Alert Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4 text-muted-foreground" />Scheduled Jobs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">ACTIVE</Badge>
                    <span className="text-sm font-medium">Health Monitor</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Every 15 min</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">ACTIVE</Badge>
                    <span className="text-sm font-medium">Deep Validation</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Daily @ 6:00 AM UTC</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">ACTIVE</Badge>
                    <span className="text-sm font-medium">Performance Optimizer</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Daily @ 7:00 AM UTC</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" />Alert Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">SMS Alerts</span>
                  <Badge className={alertConfig?.alerts_enabled !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    {alertConfig?.alerts_enabled !== false ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Throttle</span>
                  <span className="text-sm font-medium">{alertConfig?.sms_throttle_minutes || 30} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Alert Phone</span>
                  <span className="text-sm font-medium text-muted-foreground">{alertConfig?.alert_phone ? '••••' + alertConfig.alert_phone.slice(-4) : 'Using env default'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Deep Test Status</span>
                  {lastDeepTest ? (
                    <Badge className={lastDeepTest.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                      {lastDeepTest.success ? '✅ PASS' : '❌ FAIL'} — {formatDistanceToNow(new Date(lastDeepTest.created_at), { addSuffix: true })}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No deep test yet</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers & Risk */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" />Boosted Ambassadors</CardTitle>
              </CardHeader>
              <CardContent>
                {ambassadors.filter(a => a.is_boosted).length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No boosted ambassadors yet</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {ambassadors.filter(a => a.is_boosted).map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div>
                          <p className="text-sm font-medium">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground">{a.boost_reason || 'Top performer'}</p>
                        </div>
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                          {(tierConfig[a.performance_tier] || tierConfig.starter).icon} {(a.performance_tier || 'starter').toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-400" />Risk Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {ambassadors.filter(a => a.risk_level === 'high' || a.risk_level === 'medium').length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No risk alerts — all clear</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {ambassadors.filter(a => a.risk_level === 'high' || a.risk_level === 'medium').map(a => (
                      <div key={a.id} className={`flex items-center justify-between p-2 rounded-lg border ${a.risk_level === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                        <div>
                          <p className="text-sm font-medium">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground">{a.risk_reason || 'Suspicious activity'}</p>
                        </div>
                        <Badge className={a.risk_level === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}>
                          {a.risk_level?.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Latest Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-400" />Latest AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              {insights.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No active insights</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {insights.slice(0, 10).map(insight => (
                    <div key={insight.id} className={`p-2.5 rounded-lg border flex items-start gap-3 ${
                      insight.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
                      insight.severity === 'success' ? 'border-green-500/30 bg-green-500/5' :
                      'border-blue-500/30 bg-blue-500/5'
                    }`}>
                      {insightSeverityIcon(insight.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px]">{insight.insight_type?.replace(/_/g, ' ')}</Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(insight.created_at), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                        <p className="text-sm">{insight.insight_text}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismissInsight(insight.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Operation Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />Operation Log</CardTitle>
            </CardHeader>
            <CardContent>
              {opsLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No operations logged yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opsLogs.slice(0, 15).map(log => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{log.operation_type?.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={log.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                            {log.success ? '✅' : '❌'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {log.details?.error || (log.details?.auto_healed > 0 ? `${log.details.auto_healed} healed` : log.details?.processed ? `${log.details.processed} processed` : '—')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== LEADERBOARD TAB ====== */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-400" />Ambassador Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active ambassadors with revenue yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Ambassador</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Conv Rate</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Converted</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Commissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((a, i) => {
                      const tier = tierConfig[a.performance_tier] || tierConfig.starter;
                      return (
                        <TableRow key={a.id} className={i < 3 ? 'bg-amber-500/5' : ''}>
                          <TableCell>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-muted-foreground">{i + 1}</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {a.is_boosted && <Zap className="h-4 w-4 text-amber-400" />}
                              <div>
                                <p className="font-semibold">{a.full_name}</p>
                                <p className="text-xs text-muted-foreground">{a.state || '—'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${tier.bg} ${tier.color}`}>
                              {tier.icon} {(a.performance_tier || 'starter').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={Number(a.conversion_rate || 0) >= 15 ? 'text-green-400 font-medium' : ''}>
                              {Number(a.conversion_rate || 0).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>{a.total_referrals || 0}</TableCell>
                          <TableCell className="font-medium">{a.total_converted_referrals || 0}</TableCell>
                          <TableCell className="font-bold">${Number(a.total_revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-emerald-400 font-bold">${Number(a.total_commissions || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== AI INSIGHTS TAB ====== */}
        <TabsContent value="insights">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1"><Star className="h-4 w-4 text-amber-400" /><span className="text-xs">Top Performers</span></div>
                  <p className="text-xl font-bold">{ambassadors.filter(a => a.performance_tier === 'elite' || a.performance_tier === 'legend').length}</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-green-400" /><span className="text-xs">Boosted</span></div>
                  <p className="text-xl font-bold">{boostedCount}</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1"><ShieldAlert className="h-4 w-4 text-red-400" /><span className="text-xs">Risk Alerts</span></div>
                  <p className="text-xl font-bold">{riskCount}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1"><Brain className="h-4 w-4 text-blue-400" /><span className="text-xs">Active Insights</span></div>
                  <p className="text-xl font-bold">{insights.length}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  AI Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No insights yet. Click "AI Insights" or "Run Optimizer" to generate.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {insights.map((insight) => (
                      <div key={insight.id} className={`p-3 rounded-lg border flex items-start gap-3 ${
                        insight.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
                        insight.severity === 'success' ? 'border-green-500/30 bg-green-500/5' :
                        'border-blue-500/30 bg-blue-500/5'
                      }`}>
                        {insightSeverityIcon(insight.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">{insight.insight_type?.replace(/_/g, ' ')}</Badge>
                            {insight.priority >= 3 && <Badge className="bg-red-500/20 text-red-400 text-[10px]">HIGH</Badge>}
                            <span className="text-[10px] text-muted-foreground">{format(new Date(insight.created_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                          <p className="text-sm">{insight.insight_text}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismissInsight(insight.id)}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ====== REFERRAL ACTIVITY TAB ====== */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-purple-400" />Referral Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No referral activity yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.referral_code}</code></TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{r.lead_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{r.lead_email || r.lead_phone || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{r.referral_source || r.landing_page || '—'}</TableCell>
                        <TableCell><Badge className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                        <TableCell>{r.revenue_amount > 0 ? `$${Number(r.revenue_amount).toLocaleString()}` : '—'}</TableCell>
                        <TableCell className={r.commission_amount > 0 ? 'text-emerald-400 font-medium' : ''}>
                          {r.commission_amount > 0 ? `$${Number(r.commission_amount).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== PAYOUTS TAB ====== */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-400" />Payout Management</CardTitle>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No payouts created yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ambassador</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Paid At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.unforgettable_ambassadors?.full_name || '—'}</TableCell>
                        <TableCell className="font-bold">${Number(p.commission_amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{p.payout_method || '—'}</TableCell>
                        <TableCell><Badge className={payoutStatusColor(p.payout_status)}>{p.payout_status}</Badge></TableCell>
                        <TableCell className="text-xs">{format(new Date(p.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs">{p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {p.payout_status === 'pending' && (
                              <Button size="sm" className="h-7 text-xs" variant="outline" onClick={() => handlePayoutAction(p.id, 'approved')}>
                                Approve
                              </Button>
                            )}
                            {(p.payout_status === 'pending' || p.payout_status === 'approved') && (
                              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handlePayoutAction(p.id, 'paid')}>
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== HEALTH LOG TAB ====== */}
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-blue-400" />Pipeline Health Log</CardTitle>
            </CardHeader>
            <CardContent>
              {healthLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No health checks recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Failure Point</TableHead>
                      <TableHead>Auto-Heals</TableHead>
                      <TableHead>Alert</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge className={log.success ? 'bg-green-500/20 text-green-400' : 'bg-destructive/20 text-destructive'}>
                            {log.success ? '✅ PASS' : '❌ FAIL'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {(log.check_type || 'health_check').replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            log.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                            log.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-muted text-muted-foreground'
                          }>
                            {(log.severity || 'low').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.failure_point || '—'}</TableCell>
                        <TableCell>
                          {(log.auto_heal_count || 0) > 0 ? (
                            <Badge className="bg-cyan-500/20 text-cyan-400">{log.auto_heal_count} healed</Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {log.alert_sent ? <Badge className="bg-amber-500/20 text-amber-400">📱 SMS</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Payout Dialog */}
      <Dialog open={payoutDialog} onOpenChange={setPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout — {payoutTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
              <div><span className="text-muted-foreground">Total Revenue:</span> <strong>${Number(payoutTarget?.total_revenue || 0).toLocaleString()}</strong></div>
              <div><span className="text-muted-foreground">Commissions Earned:</span> <strong className="text-emerald-400">${Number(payoutTarget?.total_commissions || 0).toLocaleString()}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium">Payout Amount ($)</label>
              <Input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Input value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)} placeholder="Zelle, PayPal, CashApp, etc." />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} placeholder="Internal notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePayout} className="bg-emerald-600 hover:bg-emerald-700">Create Payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ambassador Detail Dialog */}
      <Dialog open={!!detailAmb} onOpenChange={() => setDetailAmb(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailAmb?.full_name}
              {detailAmb?.is_boosted && <Badge className="bg-amber-500/20 text-amber-400 text-xs"><Zap className="h-3 w-3 mr-1" />BOOSTED</Badge>}
              {(detailAmb?.risk_level === 'high' || detailAmb?.risk_level === 'medium') && <Badge className="bg-red-500/20 text-red-400 text-xs"><ShieldAlert className="h-3 w-3 mr-1" />{detailAmb.risk_level?.toUpperCase()} RISK</Badge>}
            </DialogTitle>
          </DialogHeader>
          {detailAmb && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{detailAmb.email || '—'}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{detailAmb.phone || '—'}</span></div>
                <div><span className="text-muted-foreground">State:</span> <span className="font-medium">{detailAmb.state || '—'}</span></div>
                <div><span className="text-muted-foreground">Tier:</span>
                  <Badge variant="outline" className={`ml-1 ${(tierConfig[detailAmb.performance_tier] || tierConfig.starter).bg} ${(tierConfig[detailAmb.performance_tier] || tierConfig.starter).color}`}>
                    {(tierConfig[detailAmb.performance_tier] || tierConfig.starter).icon} {(detailAmb.performance_tier || 'starter').toUpperCase()}
                  </Badge>
                  {detailAmb.is_tier_locked && <Badge className="ml-1 bg-muted text-muted-foreground text-[10px]">🔒 Locked</Badge>}
                </div>
                <div><span className="text-muted-foreground">Rate:</span> <span className="font-medium">{detailAmb.commission_rate}%</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColor(getAmbassadorStatusLabel(detailAmb.status))}>{getAmbassadorStatusLabel(detailAmb.status)}</Badge></div>
                <div><span className="text-muted-foreground">Conv Rate:</span> <span className="font-medium">{Number(detailAmb.conversion_rate || 0).toFixed(1)}%</span></div>
                <div><span className="text-muted-foreground">Risk:</span> <span className={`font-medium ${detailAmb.risk_level === 'high' ? 'text-red-400' : detailAmb.risk_level === 'medium' ? 'text-amber-400' : 'text-green-400'}`}>{detailAmb.risk_level || 'low'}</span></div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Performance Metrics</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>Clicks: <strong>{detailAmb.total_clicks || 0}</strong></div>
                  <div>Leads: <strong>{detailAmb.total_leads || 0}</strong></div>
                  <div>Conversions: <strong>{detailAmb.total_conversions || 0}</strong></div>
                  <div>Revenue: <strong>${Number(detailAmb.total_revenue || 0).toLocaleString()}</strong></div>
                  <div>Commissions: <strong className="text-emerald-400">${Number(detailAmb.total_commissions || 0).toLocaleString()}</strong></div>
                  <div>Rev/Click: <strong>${Number(detailAmb.revenue_per_click || 0).toFixed(2)}</strong></div>
                </div>
              </div>

              {detailAmb.boost_reason && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <h4 className="font-semibold text-sm text-amber-400 mb-1">⚡ Boost Reason</h4>
                  <p className="text-xs">{detailAmb.boost_reason}</p>
                </div>
              )}

              {detailAmb.risk_reason && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <h4 className="font-semibold text-sm text-red-400 mb-1">⚠️ Risk Reason</h4>
                  <p className="text-xs">{detailAmb.risk_reason}</p>
                </div>
              )}

              {detailAmb.active_referral_link && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold text-sm mb-1">Referral Link</h4>
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 truncate">{detailAmb.active_referral_link}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(detailAmb.active_referral_link)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <p>Referral Code: <code>{detailAmb.referral_code}</code></p>
                <p>Joined: {format(new Date(detailAmb.created_at), 'MMM d, yyyy')}</p>
                {detailAmb.approved_at && <p>Approved: {format(new Date(detailAmb.approved_at), 'MMM d, yyyy')}</p>}
                {detailAmb.last_conversion_at && <p>Last Conversion: {format(new Date(detailAmb.last_conversion_at), 'MMM d, yyyy')}</p>}
                {detailAmb.tier_updated_at && <p>Tier Updated: {format(new Date(detailAmb.tier_updated_at), 'MMM d, yyyy HH:mm')}</p>}
                {detailAmb.last_insight_at && <p>Last AI Analysis: {format(new Date(detailAmb.last_insight_at), 'MMM d, yyyy HH:mm')}</p>}
                {detailAmb.last_reengagement_at && <p>Last Re-engagement: {format(new Date(detailAmb.last_reengagement_at), 'MMM d, yyyy HH:mm')}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
