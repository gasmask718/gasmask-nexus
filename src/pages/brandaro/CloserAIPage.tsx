import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Users, CreditCard, Flame, Trophy, Shield, Crown, TrendingUp, Zap, Target, DollarSign, BarChart3 } from "lucide-react";
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

/* ── KPI Strip ── */
function KPIStrip() {
  const { data: kpis } = useCloserKPIs();
  const cards = [
    { label: "Close Rate", value: `${kpis?.closeRate ?? 0}%`, icon: Target, color: "text-emerald-400" },
    { label: "Deals Won", value: kpis?.won ?? 0, icon: Trophy, color: "text-amber-400" },
    { label: "Revenue Closed", value: `$${(kpis?.totalRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Link Clicks", value: kpis?.linksClicked ?? 0, icon: CreditCard, color: "text-blue-400" },
    { label: "Link Conv.", value: `${kpis?.linkConversion ?? 0}%`, icon: TrendingUp, color: "text-cyan-400" },
    { label: "AI Wins", value: kpis?.aiOnlyWins ?? 0, icon: Brain, color: "text-purple-400" },
    { label: "Human Wins", value: kpis?.humanAssistedWins ?? 0, icon: Users, color: "text-orange-400" },
    { label: "Avg Touches", value: kpis?.avgTouchesToClose ?? 0, icon: Zap, color: "text-yellow-400" },
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

/* ── AI Close Queue Tab ── */
function AICloseQueue() {
  const { data: sessions = [] } = useCloserSessions("open");
  const sorted = [...sessions].sort((a: any, b: any) => (b.priority_score || 0) - (a.priority_score || 0));
  return (
    <div className="space-y-3">
      {sorted.length === 0 && <p className="text-muted-foreground text-sm">No active AI close sessions.</p>}
      {sorted.map((s: any) => (
        <Card key={s.id} className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{s.lead_id?.slice(0, 8) || "Unknown"}</span>
                <Badge variant="outline" className="text-[10px]">{s.session_type}</Badge>
                {s.close_probability >= 70 && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">🔥 High Prob</Badge>}
                {s.handoff_score >= 80 && <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">⚡ Handoff Ready</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Close: {s.close_probability ?? 0}% · Urgency: {s.urgency_score ?? 0} · Priority: {s.priority_score ?? 0}
              </p>
              {s.objection_detected && <p className="text-xs text-red-400">Objection: {s.objection_detected}</p>}
            </div>
            <div className="flex gap-2">
              {s.package_interest && <Badge variant="secondary" className="text-[10px]">{s.package_interest}</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Human Handoff Queue Tab ── */
function HumanHandoffQueue() {
  const { data: queue = [] } = useHandoffQueue("pending");
  const pickHandoff = usePickHandoff();
  return (
    <div className="space-y-3">
      {queue.length === 0 && <p className="text-muted-foreground text-sm">No pending handoffs.</p>}
      {queue.map((h: any) => (
        <Card key={h.id} className="bg-card border-border border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-foreground">Lead {h.lead_id?.slice(0, 8)}</span>
                <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">Score: {h.handoff_score}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Reason: {h.reason}</p>
              {h.package_tier && <Badge variant="outline" className="text-[10px]">{h.package_tier}</Badge>}
              {h.deal_value > 0 && <span className="text-xs text-green-400">${h.deal_value.toLocaleString()}</span>}
            </div>
            <Button size="sm" onClick={() => pickHandoff.mutate({ handoffId: h.id })} disabled={pickHandoff.isPending}>
              Pick Up
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Payment Push Queue Tab ── */
function PaymentPushQueue() {
  const { data: pushes = [] } = usePaymentPushQueue();
  return (
    <div className="space-y-3">
      {pushes.length === 0 && <p className="text-muted-foreground text-sm">No payment pushes pending.</p>}
      {pushes.map((p: any) => (
        <Card key={p.id} className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-400" />
                <span className="text-sm font-medium text-foreground">Lead {p.lead_id?.slice(0, 8)}</span>
                {p.payment_link_clicked && <Badge className="bg-green-500/20 text-green-400 text-[10px]">Clicked ✓</Badge>}
                {p.payment_abandoned && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Abandoned</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Sent: {p.payment_link_sent_at ? new Date(p.payment_link_sent_at).toLocaleString() : "—"}
                {p.package_interest && ` · ${p.package_interest}`}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">{p.payment_abandoned ? "Rescue" : "Active"}</Badge>
          </CardContent>
        </Card>
      ))}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              {r.soft_rebuttal && (
                <div className="p-2 rounded bg-muted/50">
                  <p className="font-medium text-muted-foreground mb-1">Soft</p>
                  <p className="text-foreground">{r.soft_rebuttal}</p>
                </div>
              )}
              {r.aggressive_rebuttal && (
                <div className="p-2 rounded bg-muted/50">
                  <p className="font-medium text-muted-foreground mb-1">Aggressive</p>
                  <p className="text-foreground">{r.aggressive_rebuttal}</p>
                </div>
              )}
              {r.premium_rebuttal && (
                <div className="p-2 rounded bg-muted/50">
                  <p className="font-medium text-muted-foreground mb-1">Premium</p>
                  <p className="text-foreground">{r.premium_rebuttal}</p>
                </div>
              )}
            </div>
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
            {p.urgency_line && <p className="text-xs text-amber-400"><strong>Urgency:</strong> {p.urgency_line}</p>}
            {p.cta && <p className="text-xs text-emerald-400"><strong>CTA:</strong> {p.cta}</p>}
            {p.handoff_condition && <p className="text-xs text-blue-400"><strong>Handoff if:</strong> {p.handoff_condition}</p>}
          </CardContent>
        </Card>
      ))}
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
          <p className="text-sm text-muted-foreground">AI qualifies & pushes — humans close the best deals</p>
        </div>
      </div>

      <KPIStrip />

      <Tabs defaultValue="ai-queue" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="ai-queue" className="text-xs">AI Close Queue</TabsTrigger>
          <TabsTrigger value="handoff" className="text-xs">Human Handoff</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs">Payment Push</TabsTrigger>
          <TabsTrigger value="rebuttals" className="text-xs">Rebuttals</TabsTrigger>
          <TabsTrigger value="winloss" className="text-xs">Won / Lost</TabsTrigger>
          <TabsTrigger value="playbooks" className="text-xs">Playbooks</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-queue"><AICloseQueue /></TabsContent>
        <TabsContent value="handoff"><HumanHandoffQueue /></TabsContent>
        <TabsContent value="payment"><PaymentPushQueue /></TabsContent>
        <TabsContent value="rebuttals"><RebuttalEngine /></TabsContent>
        <TabsContent value="winloss"><WinLossReview /></TabsContent>
        <TabsContent value="playbooks"><PlaybooksTab /></TabsContent>
      </Tabs>
    </div>
  );
}
