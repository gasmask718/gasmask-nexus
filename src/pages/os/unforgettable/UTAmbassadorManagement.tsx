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
  Eye, ArrowUpRight, Hash, FlaskConical, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

const PINK = '#E91E8C';
const TABLE = 'unforgettable_ambassadors' as const;

const normalizeAmbassadorStatus = (status?: string | null) => {
  const normalized = (status || '').trim().toLowerCase();

  if (!normalized || normalized === 'new' || normalized === 'pending_review') {
    return 'pending';
  }

  if (normalized === 'approved') {
    return 'active';
  }

  if (normalized === 'inactive') {
    return 'suspended';
  }

  return normalized;
};

const getAmbassadorStatusLabel = (status?: string | null) => {
  const raw = (status || '').trim();
  return raw || 'pending';
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

  // Payout dialog
  const [payoutDialog, setPayoutDialog] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<any>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');

  // Detail dialog
  const [detailAmb, setDetailAmb] = useState<any>(null);

  // Pipeline test
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);

  // Health monitoring
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [monitorRunning, setMonitorRunning] = useState(false);

  const fetchAll = async () => {
    const [ambRes, refRes, payRes, healthRes] = await Promise.all([
      supabase.from(TABLE).select('*').order('created_at', { ascending: false }),
      (supabase as any).from('ut_ambassador_referrals').select('*').order('created_at', { ascending: false }).limit(200),
      (supabase as any).from('ut_ambassador_payouts').select('*, unforgettable_ambassadors(full_name)').order('created_at', { ascending: false }),
      (supabase as any).from('pipeline_health_logs').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (ambRes.data) {
      console.log('Loaded ambassadors:', ambRes.data);
      setAmbassadors(ambRes.data);
    }
    if (refRes.data) setReferrals(refRes.data);
    if (payRes.data) setPayouts(payRes.data);
    if (healthRes.data) setHealthLogs(healthRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('ut-amb-engine')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_ambassador_referrals' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_ambassador_payouts' }, fetchAll)
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

  // Leaderboard
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
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
          active_referral_link: refLink,
        })
        .eq('id', amb.id);
      if (error) throw error;

      // Send approval SMS
      try {
        await supabase.functions.invoke('ambassador-notify', {
          body: {
            event: 'approved',
            ambassador_id: amb.id,
            referral_code: amb.referral_code,
            name: amb.full_name,
            phone: amb.phone,
          },
        });
      } catch (smsErr) {
        console.warn('SMS failed, ambassador still approved:', smsErr);
      }

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

    // Send SMS when paid
    if (action === 'paid') {
      const payout = payouts.find(p => p.id === payoutId);
      if (payout) {
        try {
          await supabase.functions.invoke('ambassador-notify', {
            body: {
              event: 'payout_paid',
              ambassador_id: payout.ambassador_id,
              payout_amount: payout.commission_amount,
            },
          });
        } catch {}
      }

      // Update ambassador payout tracking
      const amb = ambassadors.find(a => a.id === payout?.ambassador_id);
      if (amb) {
        await supabase.from(TABLE).update({
          payout_status: 'paid',
          last_payout_at: new Date().toISOString(),
        }).eq('id', amb.id);
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

  const runPipelineTest = async () => {
    setPipelineRunning(true);
    setPipelineResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('run-ut-ambassador-pipeline-test');
      if (error) throw error;
      setPipelineResult(data);
      if (data?.success) {
        toast.success('Pipeline test passed ✅');
      } else {
        toast.error(`Pipeline test failed at: ${data?.failure_point || 'unknown'}`);
      }
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
      if (data?.success) {
        toast.success(`Monitor check passed ✅ ${data.auto_healed > 0 ? `(${data.auto_healed} records auto-healed)` : ''}`);
      } else {
        toast.error(`Monitor detected failure: ${data?.failure_point || 'unknown'}`);
      }
      fetchAll();
    } catch (err: any) {
      toast.error('Monitor error: ' + err.message);
    } finally {
      setMonitorRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: PINK }}>
            Ambassador Revenue Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Track referrals, attribute revenue, manage commissions & payouts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runMonitor}
            disabled={monitorRunning}
            className="gap-2"
          >
            {monitorRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {monitorRunning ? 'Monitoring...' : 'Run Health Check'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runPipelineTest}
            disabled={pipelineRunning}
            className="gap-2"
          >
            {pipelineRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {pipelineRunning ? 'Running Test...' : 'Run Pipeline Test'}
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
            {pipelineResult.test_email && (
              <p className="text-xs text-muted-foreground mt-2">Test email: {pipelineResult.test_email} • SMS: {pipelineResult.sms_sent ? '✅' : '⚠️ skipped'}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-blue-400" /><span className="text-xs text-muted-foreground">Referral Revenue</span></div>
          <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Commissions Owed</span></div>
          <p className="text-2xl font-bold text-emerald-400">${totalCommissions.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-purple-400" /><span className="text-xs text-muted-foreground">Conversions</span></div>
          <p className="text-2xl font-bold">{totalConversions}<span className="text-xs text-muted-foreground ml-1">/ {totalReferralClicks} clicks</span></p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="ambassadors" className="gap-1"><Users className="h-3.5 w-3.5" />Ambassadors</TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1"><Trophy className="h-3.5 w-3.5" />Leaderboard</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1"><Link2 className="h-3.5 w-3.5" />Referral Activity</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1"><Wallet className="h-3.5 w-3.5" />Payouts</TabsTrigger>
          <TabsTrigger value="health" className="gap-1"><Activity className="h-3.5 w-3.5" />System Health</TabsTrigger>
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
                  <p className="text-xs text-muted-foreground mt-1">Applications from the public form will appear here</p>
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

                        return (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailAmb(a)}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{a.full_name}</p>
                              <p className="text-xs text-muted-foreground">{a.email}</p>
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
                          <TableCell><Badge variant="outline" className="text-xs capitalize">{a.tier}</Badge></TableCell>
                          <TableCell>{a.commission_rate}%</TableCell>
                          <TableCell>
                            <span className="font-medium">{a.total_converted_referrals || 0}</span>
                            <span className="text-xs text-muted-foreground">/{a.total_referrals || 0}</span>
                          </TableCell>
                          <TableCell className="font-medium">${Number(a.total_revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-emerald-400 font-medium">${Number(a.total_commissions || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className={statusColor(statusLabel)}>{statusLabel}</Badge>
                              {statusLabel.toLowerCase() !== normalizedStatus && (
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  normalized: {normalizedStatus}
                                </p>
                              )}
                            </div>
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
                      <TableHead>Referrals</TableHead>
                      <TableHead>Converted</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Commissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((a, i) => (
                      <TableRow key={a.id} className={i < 3 ? 'bg-amber-500/5' : ''}>
                        <TableCell>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-muted-foreground">{i + 1}</span>}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{a.full_name}</p>
                            <p className="text-xs text-muted-foreground">{a.state || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.tier}</Badge></TableCell>
                        <TableCell>{a.total_referrals || 0}</TableCell>
                        <TableCell className="font-medium">{a.total_converted_referrals || 0}</TableCell>
                        <TableCell className="font-bold">${Number(a.total_revenue || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-emerald-400 font-bold">${Number(a.total_commissions || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== REFERRAL ACTIVITY TAB ====== */}
        <TabsContent value="referrals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-purple-400" />Referral Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              {referrals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No referral activity yet. Clicks, leads, and conversions will appear here.</p>
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
                        <TableCell className="text-xs">{format(new Date(r.created_at), 'MMM d, HH:mm')}</TableCell>
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
                <p className="text-muted-foreground text-center py-8">No payouts created yet. Use the "Payout" button on active ambassadors to create one.</p>
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
            <DialogTitle>{detailAmb?.full_name}</DialogTitle>
          </DialogHeader>
          {detailAmb && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{detailAmb.email || '—'}</span></div>
                <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{detailAmb.phone || '—'}</span></div>
                <div><span className="text-muted-foreground">State:</span> <span className="font-medium">{detailAmb.state || '—'}</span></div>
                <div><span className="text-muted-foreground">Tier:</span> <Badge variant="outline" className="capitalize">{detailAmb.tier}</Badge></div>
                <div><span className="text-muted-foreground">Rate:</span> <span className="font-medium">{detailAmb.commission_rate}%</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColor(getAmbassadorStatusLabel(detailAmb.status))}>{getAmbassadorStatusLabel(detailAmb.status)}</Badge></div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Performance</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Referrals: <strong>{detailAmb.total_referrals || 0}</strong></div>
                  <div>Converted: <strong>{detailAmb.total_converted_referrals || 0}</strong></div>
                  <div>Revenue: <strong>${Number(detailAmb.total_revenue || 0).toLocaleString()}</strong></div>
                  <div>Commissions: <strong className="text-emerald-400">${Number(detailAmb.total_commissions || 0).toLocaleString()}</strong></div>
                </div>
              </div>

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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
