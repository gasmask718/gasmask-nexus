import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Brain, Users, CreditCard, Flame, Trophy, Shield, Crown, TrendingUp, Zap, Target, DollarSign, BarChart3, Phone, MessageSquare, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, Bell, RefreshCw, Siren, RotateCcw } from "lucide-react";
import {
  useCloserKPIs,
  useCloserSessions,
  useHandoffQueue,
  useRebuttals,
  useWinLossAnalysis,
  usePaymentPushQueue,
  usePickHandoff,
  useResolveHandoff,
  usePlaybooks,
} from "@/hooks/useBrandaroCloserAI";
import { useCloserAction } from "@/hooks/useBrandaroCloserActions";
import {
  usePaymentRecoveryQueue,
  useTriggerPaymentRecovery,
  useRecoveryKPIs,
  useCloserAlerts,
  useDismissAlert,
  useAutoHandoff,
  calculateBoostedPriority,
} from "@/hooks/useBrandaroCloserRecovery";

/* ── Real-Time Alert Banner ── */
function AlertBanner() {
  const { data: alerts = [] } = useCloserAlerts();
  const dismiss = useDismissAlert();

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.slice(0, 3).map((a: any) => (
        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse">
          <div className="flex items-center gap-3">
            <Siren className="h-5 w-5 text-red-400 animate-bounce" />
            <div>
              <p className="text-sm font-bold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.detail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500/20 text-red-400 text-[10px]">Priority: {a.priority}</Badge>
            <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(a.id)} className="text-xs">
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── KPI Strip (with recovery) ── */
function KPIStrip() {
  const { data: kpis } = useCloserKPIs();
  const { data: recoveryKpis } = useRecoveryKPIs();
  const cards = [
    { label: "Close Rate", value: `${kpis?.closeRate ?? 0}%`, icon: Target, color: "text-emerald-400" },
    { label: "Deals Won", value: kpis?.won ?? 0, icon: Trophy, color: "text-amber-400" },
    { label: "Revenue Closed", value: `$${(kpis?.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Link Conv.", value: `${kpis?.linkConversion ?? 0}%`, icon: TrendingUp, color: "text-cyan-400" },
    { label: "AI Wins", value: kpis?.aiOnlyWins ?? 0, icon: Brain, color: "text-purple-400" },
    { label: "Human Wins", value: kpis?.humanAssistedWins ?? 0, icon: Users, color: "text-orange-400" },
    { label: "Recovered $", value: `$${(recoveryKpis?.recoveredRevenue ?? 0).toLocaleString()}`, icon: RotateCcw, color: "text-pink-400" },
    { label: "Recovery Rate", value: `${recoveryKpis?.recoveryRate ?? 0}%`, icon: RefreshCw, color: "text-rose-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {cards.map((c) => (
        <Card key={c.label} className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <c.icon className={`h-4 w-4 mx-auto mb-1 ${c.color}`} />
            <p className="text-lg font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── AI Close Queue Tab (Revenue-First Sort) ── */
function AICloseQueue() {
  const { data: sessions = [] } = useCloserSessions("open");
  const autoHandoff = useAutoHandoff();

  // Revenue-first sort using boosted priority
  const sorted = [...sessions]
    .map((s: any) => ({ ...s, _boostedPriority: calculateBoostedPriority(s) }))
    .sort((a: any, b: any) => b._boostedPriority - a._boostedPriority);

  const getProbLabel = (p: number) => {
    if (p >= 90) return { text: "Handoff Now", cls: "bg-red-500/20 text-red-400" };
    if (p >= 70) return { text: "Ready to Close", cls: "bg-emerald-500/20 text-emerald-400" };
    if (p >= 50) return { text: "Negotiable", cls: "bg-amber-500/20 text-amber-400" };
    if (p >= 30) return { text: "Interested", cls: "bg-blue-500/20 text-blue-400" };
    return { text: "Warming", cls: "bg-muted text-muted-foreground" };
  };

  // Auto-handoff check on load
  useEffect(() => {
    sorted.forEach((s: any) => {
      const shouldHandoff =
        s.close_probability >= 70 ||
        s.payment_link_clicked ||
        ["premium", "elite"].includes(s.package_interest);
      if (shouldHandoff && s.handoff_score >= 80) {
        // Visual indicator only — manual trigger via button
      }
    });
  }, [sorted.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">Sorted by deal value + close probability (highest revenue first)</p>
      </div>
      {sorted.length === 0 && <p className="text-muted-foreground text-sm">No active AI close sessions.</p>}
      {sorted.map((s: any) => {
        const prob = getProbLabel(s.close_probability || 0);
        const shouldAutoHandoff = (s.close_probability >= 70 || s.payment_link_clicked || ["premium", "elite"].includes(s.package_interest));
        return (
          <Card key={s.id} className={`bg-card border-border ${shouldAutoHandoff ? 'border-l-4 border-l-red-500' : ''}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{s.lead_id?.slice(0, 8) || "Unknown"}</span>
                  <Badge variant="outline" className="text-[10px]">{s.session_type}</Badge>
                  <Badge className={`text-[10px] ${prob.cls}`}>{prob.text}</Badge>
                  {shouldAutoHandoff && <Badge className="bg-red-500/20 text-red-400 text-[10px] animate-pulse">⚡ AUTO-HANDOFF</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Close: {s.close_probability ?? 0}% · Priority: <span className="text-amber-400 font-bold">{s._boostedPriority}</span>
                  {s.package_interest && ` · ${s.package_interest.toUpperCase()}`}
                </p>
                {s.objection_detected && <p className="text-xs text-red-400">Objection: {s.objection_detected}</p>}
              </div>
              <div className="flex flex-col gap-1 items-end">
                {s.payment_link_sent && <Badge className="bg-green-500/20 text-green-400 text-[10px]">💳 Link Sent</Badge>}
                {s.payment_link_clicked && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">✓ Clicked</Badge>}
                {shouldAutoHandoff && (
                  <Button size="sm" variant="destructive" className="text-[10px] mt-1"
                    onClick={() => autoHandoff.mutate(s)} disabled={autoHandoff.isPending}>
                    Escalate to Human
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Human Handoff Queue Tab ── */
function HumanHandoffQueue() {
  const { data: queue = [] } = useHandoffQueue("pending");
  const { data: inProgress = [] } = useHandoffQueue("in_progress");
  const pickHandoff = usePickHandoff();
  const resolveHandoff = useResolveHandoff();
  const closerAction = useCloserAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [smsText, setSmsText] = useState<Record<string, string>>({});
  const [showSms, setShowSms] = useState<Record<string, boolean>>({});

  // Sort by deal value DESC
  const sortedQueue = [...queue].sort((a: any, b: any) => (b.deal_value || 0) - (a.deal_value || 0));
  const sortedInProgress = [...inProgress].sort((a: any, b: any) => (b.deal_value || 0) - (a.deal_value || 0));

  const getLeadPhone = (h: any) => h.brandaro_closer_sessions?.lead_phone || "";

  const renderCard = (h: any, isPicked: boolean) => {
    const phone = getLeadPhone(h);
    return (
    <Card key={h.id} className={`bg-card border-border border-l-4 ${isPicked ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-foreground">Lead {h.lead_id?.slice(0, 8)}</span>
            <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Score: {h.handoff_score}</Badge>
            {h.package_tier && (
              <Badge className={`text-[10px] ${
                h.package_tier === "elite" ? "bg-purple-500/20 text-purple-400" :
                h.package_tier === "premium" ? "bg-pink-500/20 text-pink-400" :
                "bg-muted text-muted-foreground"
              }`}>{h.package_tier?.toUpperCase()}</Badge>
            )}
            {h.deal_value > 0 && <span className="text-sm text-green-400 font-bold">${h.deal_value.toLocaleString()}</span>}
            {phone && <span className="text-xs text-muted-foreground">📞 {phone}</span>}
          </div>
          <Badge variant="outline" className="text-[10px]">{isPicked ? "In Progress" : "Pending"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Reason: {h.reason}</p>

        <div className="flex flex-wrap gap-2">
          {!isPicked && (
            <Button size="sm" onClick={() => pickHandoff.mutate({ handoffId: h.id })} disabled={pickHandoff.isPending}>
              Pick Up
            </Button>
          )}
          {isPicked && (
            <>
              <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[11px]"
                onClick={() => resolveHandoff.mutate({ handoffId: h.id, outcome: "won", notes: notes[h.id] })}>
                <Trophy className="h-3 w-3 mr-1" /> Mark Won
              </Button>
              <Button size="sm" variant="destructive" className="text-[11px]"
                onClick={() => resolveHandoff.mutate({ handoffId: h.id, outcome: "lost", notes: notes[h.id] })}>
                Mark Lost
              </Button>
              <Button size="sm" variant="outline" className="text-[11px]"
                disabled={!phone || closerAction.isPending}
                onClick={() => closerAction.mutate({ action: "call", phone, leadId: h.lead_id, sessionId: h.session_id })}>
                <Phone className="h-3 w-3 mr-1" /> Call Now
              </Button>
              <Button size="sm" variant="outline" className="text-[11px]"
                onClick={() => setShowSms(p => ({ ...p, [h.id]: !p[h.id] }))}>
                <MessageSquare className="h-3 w-3 mr-1" /> Text
              </Button>
              <Button size="sm" variant="outline" className="text-[11px]"
                disabled={!phone || closerAction.isPending}
                onClick={() => closerAction.mutate({ action: "payment_link", phone, leadId: h.lead_id, sessionId: h.session_id })}>
                <CreditCard className="h-3 w-3 mr-1" /> Send Payment Link
              </Button>
              <Button size="sm" variant="outline" className="text-[11px]"><ArrowUpRight className="h-3 w-3 mr-1" /> Upgrade</Button>
              <Button size="sm" variant="outline" className="text-[11px]"><ArrowDownRight className="h-3 w-3 mr-1" /> Downgrade Save</Button>
              <Button size="sm" variant="outline" className="text-[11px]"><Clock className="h-3 w-3 mr-1" /> Set Callback</Button>
            </>
          )}
        </div>

        {/* Inline SMS Composer */}
        {showSms[h.id] && isPicked && (
          <div className="flex gap-2">
            <Input placeholder="Type message..." className="text-xs flex-1"
              value={smsText[h.id] || ""} onChange={(e) => setSmsText(p => ({ ...p, [h.id]: e.target.value }))} />
            <Button size="sm" disabled={!phone || !smsText[h.id] || closerAction.isPending}
              onClick={() => { closerAction.mutate({ action: "sms", phone, message: smsText[h.id], leadId: h.lead_id, sessionId: h.session_id }); setSmsText(p => ({ ...p, [h.id]: "" })); }}>
              Send
            </Button>
          </div>
        )}

        {isPicked && (
          <Textarea placeholder="Closer notes — what closed or lost the deal?" className="text-xs h-16"
            value={notes[h.id] || ""} onChange={(e) => setNotes(prev => ({ ...prev, [h.id]: e.target.value }))} />
        )}
      </CardContent>
    </Card>
  );};


  return (
    <div className="space-y-4">
      {sortedInProgress.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" /> Active Closes ({sortedInProgress.length})
          </h3>
          {sortedInProgress.map((h: any) => renderCard(h, true))}
        </div>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" /> Pending Handoffs ({sortedQueue.length})
        </h3>
        {sortedQueue.length === 0 && <p className="text-muted-foreground text-sm">No pending handoffs.</p>}
        {sortedQueue.map((h: any) => renderCard(h, false))}
      </div>
    </div>
  );
}

/* ── Payment Recovery Tab (NEW) ── */
function PaymentRecoveryQueue() {
  const { data: pushes = [] } = usePaymentPushQueue();
  const { data: recoveries = [] } = usePaymentRecoveryQueue();
  const triggerRecovery = useTriggerPaymentRecovery();
  const { data: recoveryKpis } = useRecoveryKPIs();

  // Group recoveries by session
  const recoveryBySession: Record<string, any[]> = {};
  recoveries.forEach((r: any) => {
    if (!recoveryBySession[r.session_id]) recoveryBySession[r.session_id] = [];
    recoveryBySession[r.session_id].push(r);
  });

  return (
    <div className="space-y-4">
      {/* Recovery KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-pink-400">{recoveryKpis?.totalMessages ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Recovery Messages</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-emerald-400">{recoveryKpis?.recovered ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Deals Recovered</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-green-400">${(recoveryKpis?.recoveredRevenue ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Recovered Revenue</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{recoveryKpis?.recoveryRate ?? 0}%</p>
            <p className="text-[10px] text-muted-foreground">Recovery Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid sessions that need recovery */}
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-400" /> Unpaid Payment Links — Auto Recovery
      </h3>
      {pushes.length === 0 && <p className="text-muted-foreground text-sm">No unpaid payment links.</p>}
      {pushes.map((p: any) => {
        const hasRecovery = recoveryBySession[p.id]?.length > 0;
        const recoverySteps = recoveryBySession[p.id] || [];
        return (
          <Card key={p.id} className={`bg-card border-border ${p.payment_link_clicked ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-red-500'}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-medium text-foreground">Lead {p.lead_id?.slice(0, 8)}</span>
                  {p.payment_link_clicked && <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Clicked but unpaid</Badge>}
                  {!p.payment_link_clicked && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Not opened</Badge>}
                  {p.package_interest && <Badge variant="outline" className="text-[10px]">{p.package_interest}</Badge>}
                </div>
                <div className="flex gap-2">
                  {!hasRecovery && (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-[11px]"
                      onClick={() => triggerRecovery.mutate({ sessionId: p.id, leadId: p.lead_id })}
                      disabled={triggerRecovery.isPending}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Launch Recovery
                    </Button>
                  )}
                  {hasRecovery && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Recovery Active</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Sent: {p.payment_link_sent_at ? new Date(p.payment_link_sent_at).toLocaleString() : "—"}
              </p>

              {/* Recovery Timeline */}
              {hasRecovery && (
                <div className="space-y-1 pl-4 border-l-2 border-muted">
                  {recoverySteps.sort((a: any, b: any) => a.step - b.step).map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${
                        r.status === "sent" ? "bg-emerald-400" : r.status === "pending" ? "bg-amber-400" : "bg-muted"
                      }`} />
                      <span className="text-muted-foreground">Step {r.step}:</span>
                      <span className="text-foreground truncate max-w-xs">{r.message_content}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {r.status === "sent" ? "✓ Sent" : new Date(r.scheduled_at).toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Objection Heatmap Tab ── */
function ObjectionHeatmap() {
  const { data: rebuttals = [] } = useRebuttals();
  const sorted = [...rebuttals].sort((a: any, b: any) => (b.times_used || 0) - (a.times_used || 0));
  const maxUsed = Math.max(...sorted.map((r: any) => r.times_used || 1), 1);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Objection frequency & win rate — darker = more common, green = higher close rate</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map((r: any) => {
          const winRate = r.close_success_rate || 0;
          const borderColor = winRate >= 60 ? "border-emerald-500" : winRate >= 40 ? "border-amber-500" : "border-red-500";
          return (
            <Card key={r.id} className={`bg-card border-2 ${borderColor}`}>
              <CardContent className="p-3 text-center space-y-1">
                <p className="text-sm font-bold text-foreground">{r.label}</p>
                <div className="flex justify-center gap-3 text-xs">
                  <span className="text-muted-foreground">Used: {r.times_used}</span>
                  <span className={winRate >= 50 ? "text-emerald-400" : "text-red-400"}>Win: {winRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full ${winRate >= 60 ? "bg-emerald-500" : winRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${winRate}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ── Rebuttal Engine Tab ── */
function RebuttalEngine() {
  const { data: rebuttals = [] } = useRebuttals();
  return (
    <div className="space-y-3">
      {rebuttals.length === 0 && <p className="text-muted-foreground text-sm">No rebuttals configured yet.</p>}
      {rebuttals.map((r: any) => (
        <Card key={r.id} className="bg-card border-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold text-foreground">{r.label}</span>
                <Badge variant="outline" className="text-[10px]">{r.objection_key}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Used: {r.times_used}</span>
                <span className="text-xs text-emerald-400">Win: {r.close_success_rate}%</span>
              </div>
            </div>
            {r.ai_response && (
              <div className="p-2 rounded bg-purple-500/10 text-xs">
                <p className="font-medium text-purple-400 mb-1">🤖 AI Response</p>
                <p className="text-foreground">{r.ai_response}</p>
              </div>
            )}
            {r.human_response && (
              <div className="p-2 rounded bg-orange-500/10 text-xs">
                <p className="font-medium text-orange-400 mb-1">👤 Human Closer</p>
                <p className="text-foreground">{r.human_response}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {r.soft_rebuttal && (<div className="p-2 rounded bg-muted/50"><p className="font-medium text-muted-foreground mb-1">Soft</p><p className="text-foreground">{r.soft_rebuttal}</p></div>)}
              {r.aggressive_rebuttal && (<div className="p-2 rounded bg-muted/50"><p className="font-medium text-muted-foreground mb-1">Aggressive</p><p className="text-foreground">{r.aggressive_rebuttal}</p></div>)}
              {r.premium_rebuttal && (<div className="p-2 rounded bg-muted/50"><p className="font-medium text-muted-foreground mb-1">Premium</p><p className="text-foreground">{r.premium_rebuttal}</p></div>)}
            </div>
            {(r.downgrade_path || r.upsell_path) && (
              <div className="flex gap-3 text-xs">
                {r.downgrade_path && <span className="text-blue-400">↓ {r.downgrade_path}</span>}
                {r.upsell_path && <span className="text-green-400">↑ {r.upsell_path}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Win/Loss Review Tab ── */
function WinLossReview() {
  const { data: records = [] } = useWinLossAnalysis();
  const won = records.filter((r: any) => r.result === "won");
  const lost = records.filter((r: any) => r.result === "lost");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-400">Won Deals ({won.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {won.length === 0 && <p className="text-xs text-muted-foreground">No won deals yet.</p>}
            {won.map((w: any) => (
              <div key={w.id} className="p-2 rounded bg-muted/30 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">${(w.deal_value || 0).toLocaleString()}</span>
                  <Badge variant="outline" className="text-[10px]">{w.package || "—"}</Badge>
                </div>
                {w.won_trigger && <p className="text-emerald-400">Trigger: {w.won_trigger}</p>}
                {w.objection_overcome && <p className="text-muted-foreground">Overcame: {w.objection_overcome}</p>}
                <p className="text-muted-foreground">Closer: {w.closer_type} · {w.touches_to_close} touches</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-red-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-400">Lost Deals ({lost.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {lost.length === 0 && <p className="text-xs text-muted-foreground">No lost deals yet.</p>}
            {lost.map((l: any) => (
              <div key={l.id} className="p-2 rounded bg-muted/30 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">${(l.deal_value || 0).toLocaleString()}</span>
                  <Badge variant="outline" className="text-[10px]">{l.package || "—"}</Badge>
                </div>
                {l.lost_reason && <p className="text-red-400">Reason: {l.lost_reason}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Playbooks Tab ── */
function PlaybooksTab() {
  const { data: playbooks = [] } = usePlaybooks();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {playbooks.length === 0 && <p className="text-muted-foreground text-sm col-span-2">No playbooks configured yet.</p>}
      {playbooks.map((p: any) => (
        <Card key={p.id} className="bg-card border-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-bold text-foreground">{p.label}</span>
              <Badge variant="outline" className="text-[10px]">{p.playbook_key}</Badge>
            </div>
            {p.opening_line && <p className="text-xs text-muted-foreground"><strong>Open:</strong> {p.opening_line}</p>}
            {p.emotional_frame && <p className="text-xs text-pink-400"><strong>Frame:</strong> {p.emotional_frame}</p>}
            {p.value_positioning && <p className="text-xs text-cyan-400"><strong>Value:</strong> {p.value_positioning}</p>}
            {p.urgency_line && <p className="text-xs text-amber-400"><strong>Urgency:</strong> {p.urgency_line}</p>}
            {p.cta && <p className="text-xs text-emerald-400"><strong>CTA:</strong> {p.cta}</p>}
            {p.handoff_condition && <p className="text-xs text-blue-400"><strong>Handoff if:</strong> {p.handoff_condition}</p>}
            {p.stop_condition && <p className="text-xs text-red-400"><strong>Stop if:</strong> {p.stop_condition}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Premium Deal Desk Tab ── */
function PremiumDealDesk() {
  const { data: sessions = [] } = useCloserSessions();
  const autoHandoff = useAutoHandoff();
  const premiumDeals = sessions.filter((s: any) =>
    (s.package_interest === "premium" || s.package_interest === "elite") && !s.closed
  ).sort((a: any, b: any) => (b.close_probability || 0) - (a.close_probability || 0));
  const { data: handoffs = [] } = useHandoffQueue();
  const premiumHandoffs = handoffs.filter((h: any) => h.package_tier === "premium" || h.package_tier === "elite");

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border border-l-4 border-l-purple-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
            <Crown className="h-4 w-4" /> Premium / Elite Pipeline ({premiumDeals.length} active)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">⚠️ Premium leads must NEVER die in AI loops — auto-escalate to human closer</p>
          {premiumDeals.length === 0 && <p className="text-xs text-muted-foreground">No premium deals in pipeline.</p>}
          {premiumDeals.map((s: any) => (
            <div key={s.id} className="p-3 rounded bg-purple-500/10 border border-purple-500/30 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-3 w-3 text-purple-400" />
                  <span className="text-foreground font-medium">Lead {s.lead_id?.slice(0, 8)}</span>
                  <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">{s.package_interest?.toUpperCase()}</Badge>
                  <span className="text-green-400 font-bold">
                    ${s.package_interest === "elite" ? "5,000" : "3,000"}
                  </span>
                </div>
                <span className="text-muted-foreground">Close: {s.close_probability ?? 0}%</span>
              </div>
              {s.objection_detected && <p className="text-amber-400">Objection: {s.objection_detected}</p>}
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-[11px] border-purple-500/30">
                  <Phone className="h-3 w-3 mr-1" /> Call Now
                </Button>
                <Button size="sm" variant="outline" className="text-[11px] border-purple-500/30">
                  <CreditCard className="h-3 w-3 mr-1" /> Send Premium Link
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-[11px]"
                  onClick={() => autoHandoff.mutate(s)} disabled={autoHandoff.isPending}>
                  <Users className="h-3 w-3 mr-1" /> Escalate Now
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {premiumHandoffs.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">Premium Handoffs Waiting</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {premiumHandoffs.map((h: any) => (
              <div key={h.id} className="p-2 rounded bg-amber-500/10 text-xs flex justify-between items-center">
                <div>
                  <span className="text-foreground font-medium">Lead {h.lead_id?.slice(0, 8)}</span>
                  <span className="text-muted-foreground ml-2">${(h.deal_value || 0).toLocaleString()}</span>
                </div>
                <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Score: {h.handoff_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function CloserAIPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen bg-background">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Closer AI + Human Closer Desk</h1>
          <p className="text-sm text-muted-foreground">AI qualifies & pushes — humans close the best deals — system recovers every dollar</p>
        </div>
      </div>

      {/* Real-Time Alert Banner */}
      <AlertBanner />

      <KPIStrip />

      <Tabs defaultValue="ai-queue" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="ai-queue" className="text-xs">AI Close Queue</TabsTrigger>
          <TabsTrigger value="handoff" className="text-xs">Human Handoff</TabsTrigger>
          <TabsTrigger value="recovery" className="text-xs flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Payment Recovery
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="text-xs">Objection Heatmap</TabsTrigger>
          <TabsTrigger value="winloss" className="text-xs">Won / Lost</TabsTrigger>
          <TabsTrigger value="rebuttals" className="text-xs">Rebuttals</TabsTrigger>
          <TabsTrigger value="premium" className="text-xs">Premium Desk</TabsTrigger>
          <TabsTrigger value="playbooks" className="text-xs">Playbooks</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-queue"><AICloseQueue /></TabsContent>
        <TabsContent value="handoff"><HumanHandoffQueue /></TabsContent>
        <TabsContent value="recovery"><PaymentRecoveryQueue /></TabsContent>
        <TabsContent value="heatmap"><ObjectionHeatmap /></TabsContent>
        <TabsContent value="winloss"><WinLossReview /></TabsContent>
        <TabsContent value="rebuttals"><RebuttalEngine /></TabsContent>
        <TabsContent value="premium"><PremiumDealDesk /></TabsContent>
        <TabsContent value="playbooks"><PlaybooksTab /></TabsContent>
      </Tabs>
    </div>
  );
}
