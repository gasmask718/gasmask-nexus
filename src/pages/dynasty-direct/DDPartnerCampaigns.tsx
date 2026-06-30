// Dynasty Direct — Partner Campaigns OS page.
// Tabs: Partner Links · Campaigns · Earnings
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Handshake, Megaphone, DollarSign, Copy, Loader2, Banknote } from "lucide-react";

const PUBLIC_ORIGIN = (typeof window !== "undefined" && window.location.origin.includes("dynastydirect"))
  ? window.location.origin
  : "https://dynastydirect.com";

type Ambassador = { id: string; name: string | null; email: string | null };
type Wholesaler = { id: string; name: string | null };
type PartnerLink = {
  id: string;
  ambassador_id: string | null;
  wholesaler_id: string | null;
  revenue_share_pct: number | null;
  status: string;
  total_orders: number | null;
  total_revenue_generated: number | null;
  total_earned: number | null;
  notes: string | null;
  created_at: string;
};
type Campaign = {
  id: string;
  campaign_code: string;
  name: string;
  ambassador_id: string | null;
  partner_wholesaler_link_id: string | null;
  preferred_wholesaler_id: string | null;
  commission_override_pct: number | null;
  ends_at: string | null;
  total_clicks: number | null;
  total_orders: number | null;
  total_revenue: number | null;
  total_commission: number | null;
  status: string;
};
type Earning = {
  id: string;
  ambassador_id: string | null;
  wholesaler_id: string | null;
  campaign_id: string | null;
  order_id: string | null;
  order_revenue: number;
  commission_pct: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
};

function money(n: number | null | undefined) {
  return `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function genCampaignCode(seed: string) {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "camp";
  return `${slug}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export default function DDPartnerCampaigns() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Handshake className="w-8 h-8" /> Partner Campaigns
        </h1>
        <p className="text-muted-foreground mt-1">
          Ambassador ↔ wholesaler partnerships, supplier-direct campaign routing, and partner earnings.
        </p>
      </div>
      <Tabs defaultValue="links" className="w-full">
        <TabsList>
          <TabsTrigger value="links"><Handshake className="w-4 h-4 mr-1" /> Partner Links</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="w-4 h-4 mr-1" /> Campaigns</TabsTrigger>
          <TabsTrigger value="earnings"><DollarSign className="w-4 h-4 mr-1" /> Earnings</TabsTrigger>
          <TabsTrigger value="settlement"><Banknote className="w-4 h-4 mr-1" /> Settlement</TabsTrigger>
        </TabsList>
        <TabsContent value="links"><PartnerLinksTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="earnings"><EarningsTab /></TabsContent>
        <TabsContent value="settlement"><SettlementTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Partner Links
// ─────────────────────────────────────────────────────────────────────────────
function PartnerLinksTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ambId, setAmbId] = useState<string>("");
  const [wholesalerId, setWholesalerId] = useState<string>("");
  const [pct, setPct] = useState<string>("10");
  const [notes, setNotes] = useState<string>("");

  const { data: ambassadors = [] } = useQuery({
    queryKey: ["ambassadors-min"],
    queryFn: async () => {
      const { data } = await supabase.from("ambassadors").select("id, name, email").order("name");
      return (data ?? []) as Ambassador[];
    },
  });
  const { data: wholesalers = [] } = useQuery({
    queryKey: ["wholesalers-min"],
    queryFn: async () => {
      const { data } = await supabase.from("wholesalers").select("id, name").is("deleted_at", null).order("name");
      return (data ?? []) as Wholesaler[];
    },
  });
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["dd-partner-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_partner_wholesaler_links")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as PartnerLink[];
    },
  });
  const { data: earnings = [] } = useQuery({
    queryKey: ["dd-partner-earnings"],
    queryFn: async () => {
      const { data } = await supabase.from("dd_partner_earnings").select("status, commission_amount, order_revenue, created_at");
      return (data ?? []) as Pick<Earning, "status" | "commission_amount" | "order_revenue" | "created_at">[];
    },
  });

  const ambName = (id: string | null) => ambassadors.find((a) => a.id === id)?.name ?? "—";
  const whName = (id: string | null) => wholesalers.find((w) => w.id === id)?.name ?? "—";

  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthRev = earnings
      .filter((e) => new Date(e.created_at) >= monthStart)
      .reduce((s, e) => s + Number(e.order_revenue ?? 0), 0);
    const owed = earnings.filter((e) => e.status === "pending" || e.status === "approved")
      .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
    const paid = earnings.filter((e) => e.status === "paid")
      .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
    return {
      active: links.filter((l) => l.status === "active").length,
      monthRev, owed, paid,
    };
  }, [links, earnings]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!ambId || !wholesalerId) throw new Error("Pick an ambassador and a wholesaler");
      const { error } = await supabase.from("dd_partner_wholesaler_links").insert({
        ambassador_id: ambId,
        wholesaler_id: wholesalerId,
        revenue_share_pct: Number(pct) || 10,
        notes: notes || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partner link created (pending approval)");
      setOpen(false); setAmbId(""); setWholesalerId(""); setPct("10"); setNotes("");
      qc.invalidateQueries({ queryKey: ["dd-partner-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: async (row: PartnerLink) => {
      const { error } = await supabase
        .from("dd_partner_wholesaler_links")
        .update({ status: "active", approved_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      // Fire optional SMS via send-sms function (best-effort)
      try {
        const amb = ambassadors.find((a) => a.id === row.ambassador_id);
        const wh = wholesalers.find((w) => w.id === row.wholesaler_id);
        await supabase.functions.invoke("send-sms", {
          body: {
            ambassador_id: row.ambassador_id,
            message: `🎉 Your partner link for ${wh?.name ?? "supplier"} is active! You earn ${row.revenue_share_pct ?? 10}% on all orders from their products.\n\nYour campaign link: ${PUBLIC_ORIGIN}/products?ref=${amb?.email ?? row.ambassador_id}&supplier=${row.wholesaler_id}`,
          },
        });
      } catch { /* SMS optional */ }
    },
    onSuccess: () => {
      toast.success("Partner link approved");
      qc.invalidateQueries({ queryKey: ["dd-partner-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePctMut = useMutation({
    mutationFn: async (vars: { id: string; pct: number }) => {
      const { error } = await supabase
        .from("dd_partner_wholesaler_links")
        .update({ revenue_share_pct: vars.pct })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Share % updated");
      qc.invalidateQueries({ queryKey: ["dd-partner-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const terminateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dd_partner_wholesaler_links")
        .update({ status: "terminated" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Partner link terminated");
      qc.invalidateQueries({ queryKey: ["dd-partner-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Partners" value={stats.active} />
        <StatCard label="Revenue This Month" value={money(stats.monthRev)} />
        <StatCard label="Commissions Owed" value={money(stats.owed)} />
        <StatCard label="Paid Out" value={money(stats.paid)} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Wholesaler Partner Links</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Ambassadors who refer wholesalers earn % of all revenue from that supplier's products.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New Partner Link</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Partner Link</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Ambassador</Label>
                  <Select value={ambId} onValueChange={setAmbId}>
                    <SelectTrigger><SelectValue placeholder="Pick ambassador" /></SelectTrigger>
                    <SelectContent>
                      {ambassadors.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name ?? a.email ?? a.id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Wholesaler</Label>
                  <Select value={wholesalerId} onValueChange={setWholesalerId}>
                    <SelectTrigger><SelectValue placeholder="Pick wholesaler" /></SelectTrigger>
                    <SelectContent>
                      {wholesalers.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name ?? w.id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Revenue Share %</Label>
                  <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <div>Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Ambassador</th><th>Wholesaler</th><th>Share %</th>
                    <th>Orders</th><th>Revenue</th><th>Earned</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-2">{ambName(l.ambassador_id)}</td>
                      <td>{whName(l.wholesaler_id)}</td>
                      <td>
                        <Input
                          type="number"
                          defaultValue={l.revenue_share_pct ?? 10}
                          className="w-20 h-8"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== Number(l.revenue_share_pct)) updatePctMut.mutate({ id: l.id, pct: v });
                          }}
                        />
                      </td>
                      <td>{l.total_orders ?? 0}</td>
                      <td>{money(l.total_revenue_generated)}</td>
                      <td>{money(l.total_earned)}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td className="space-x-2 whitespace-nowrap">
                        {l.status === "pending" && (
                          <Button size="sm" onClick={() => approveMut.mutate(l)}>Approve</Button>
                        )}
                        {l.status !== "terminated" && (
                          <Button size="sm" variant="destructive" onClick={() => terminateMut.mutate(l.id)}>
                            Terminate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {links.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No partner links yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Campaigns
// ─────────────────────────────────────────────────────────────────────────────
function CampaignsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showLinks, setShowLinks] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    ambassador_id: "",
    link_id: "",
    override_pct: "",
    ends_at: "",
  });

  const { data: ambassadors = [] } = useQuery({
    queryKey: ["ambassadors-min"],
    queryFn: async () => {
      const { data } = await supabase.from("ambassadors").select("id, name, email").order("name");
      return (data ?? []) as Ambassador[];
    },
  });
  const { data: wholesalers = [] } = useQuery({
    queryKey: ["wholesalers-min"],
    queryFn: async () => {
      const { data } = await supabase.from("wholesalers").select("id, name").is("deleted_at", null).order("name");
      return (data ?? []) as Wholesaler[];
    },
  });
  const { data: links = [] } = useQuery({
    queryKey: ["dd-partner-links-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_partner_wholesaler_links")
        .select("id, ambassador_id, wholesaler_id, revenue_share_pct, status")
        .eq("status", "active");
      return (data ?? []) as PartnerLink[];
    },
  });
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["dd-campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("dd_campaigns").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const ambName = (id: string | null) => ambassadors.find((a) => a.id === id)?.name ?? "—";
  const whName = (id: string | null) => wholesalers.find((w) => w.id === id)?.name ?? "—";

  const selectedLink = links.find((l) => l.id === form.link_id);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Campaign name is required");
      if (!form.ambassador_id || !form.link_id) throw new Error("Pick ambassador + partner link");
      const code = form.code.trim().toUpperCase() || genCampaignCode(form.name);
      const link = links.find((l) => l.id === form.link_id);
      const payload = {
        campaign_code: code,
        name: form.name,
        ambassador_id: form.ambassador_id,
        partner_wholesaler_link_id: form.link_id,
        preferred_wholesaler_id: link?.wholesaler_id ?? null,
        commission_override_pct: form.override_pct ? Number(form.override_pct) : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        status: "active",
      };
      const { data, error } = await supabase.from("dd_campaigns").insert(payload).select("*").single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: (c) => {
      toast.success("Campaign created");
      setOpen(false);
      setForm({ name: "", code: "", ambassador_id: "", link_id: "", override_pct: "", ends_at: "" });
      qc.invalidateQueries({ queryKey: ["dd-campaigns"] });
      setShowLinks(c);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaignLink = (c: Campaign) => {
    const amb = ambassadors.find((a) => a.id === c.ambassador_id);
    const ref = amb?.email ?? c.ambassador_id ?? "";
    return `${PUBLIC_ORIGIN}/products?ref=${encodeURIComponent(ref)}&campaign=${c.campaign_code}&supplier=${c.preferred_wholesaler_id ?? ""}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Campaigns</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Track video content campaigns with supplier-direct routing.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Create Campaign</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Campaign</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Campaign Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer Party Supplies" />
                </div>
                <div>
                  <Label>Campaign Code (auto if blank)</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER24" />
                </div>
                <div>
                  <Label>Ambassador</Label>
                  <Select value={form.ambassador_id} onValueChange={(v) => setForm({ ...form, ambassador_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick ambassador" /></SelectTrigger>
                    <SelectContent>
                      {ambassadors.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name ?? a.email ?? a.id.slice(0,8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Partner Wholesaler Link</Label>
                  <Select value={form.link_id} onValueChange={(v) => setForm({ ...form, link_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick partner link" /></SelectTrigger>
                    <SelectContent>
                      {links
                        .filter((l) => !form.ambassador_id || l.ambassador_id === form.ambassador_id)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {whName(l.wholesaler_id)} ({l.revenue_share_pct}%)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedLink && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Routes orders → {whName(selectedLink.wholesaler_id)}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Commission Override % (blank = use link's {selectedLink?.revenue_share_pct ?? 10}%)</Label>
                  <Input type="number" value={form.override_pct} onChange={(e) => setForm({ ...form, override_pct: e.target.value })} />
                </div>
                <div>
                  <Label>Valid Until (optional)</Label>
                  <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? <div>Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Campaign</th><th>Code</th><th>Ambassador</th><th>Supplier</th>
                    <th>Clicks</th><th>Orders</th><th>Revenue</th><th>Commission</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-2">{c.name}</td>
                      <td><code>{c.campaign_code}</code></td>
                      <td>{ambName(c.ambassador_id)}</td>
                      <td>{whName(c.preferred_wholesaler_id)}</td>
                      <td>{c.total_clicks ?? 0}</td>
                      <td>{c.total_orders ?? 0}</td>
                      <td>{money(c.total_revenue)}</td>
                      <td>{money(c.total_commission)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <Button size="sm" variant="outline" onClick={() => setShowLinks(c)}>
                          <Copy className="w-3 h-3 mr-1" /> Links
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">No campaigns yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!showLinks} onOpenChange={(o) => !o && setShowLinks(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Campaign Links — {showLinks?.name}</DialogTitle></DialogHeader>
          {showLinks && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Share these links in your content:</p>
              <div>
                <Label>Full catalog</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={campaignLink(showLinks)} />
                  <Button onClick={() => { navigator.clipboard.writeText(campaignLink(showLinks)); toast.success("Copied"); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Specific product links: append <code>/[product-id]</code> after <code>/products</code>.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: Earnings
// ─────────────────────────────────────────────────────────────────────────────
function EarningsTab() {
  const qc = useQueryClient();

  const { data: earnings = [], isLoading } = useQuery({
    queryKey: ["dd-partner-earnings-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dd_partner_earnings")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Earning[];
    },
  });
  const { data: ambassadors = [] } = useQuery({
    queryKey: ["ambassadors-min"],
    queryFn: async () => {
      const { data } = await supabase.from("ambassadors").select("id, name, email");
      return (data ?? []) as Ambassador[];
    },
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["dd-campaigns-min"],
    queryFn: async () => {
      const { data } = await supabase.from("dd_campaigns").select("id, name, campaign_code");
      return (data ?? []) as Pick<Campaign, "id" | "name" | "campaign_code">[];
    },
  });

  const ambName = (id: string | null) => ambassadors.find((a) => a.id === id)?.name ?? "—";
  const campName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? "—";

  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    return {
      pending: earnings.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.commission_amount), 0),
      approved: earnings.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.commission_amount), 0),
      paidMonth: earnings.filter((e) => e.status === "paid" && e.paid_at && new Date(e.paid_at) >= monthStart)
        .reduce((s, e) => s + Number(e.commission_amount), 0),
    };
  }, [earnings]);

  const setStatusMut = useMutation({
    mutationFn: async (vars: { ids: string[]; status: "approved" | "paid" | "cancelled" }) => {
      const patch: Record<string, unknown> = { status: vars.status };
      if (vars.status === "paid") patch.paid_at = new Date().toISOString();
      const { error } = await supabase.from("dd_partner_earnings").update(patch).in("id", vars.ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} earnings → ${v.status}`);
      qc.invalidateQueries({ queryKey: ["dd-partner-earnings-full"] });
      qc.invalidateQueries({ queryKey: ["dd-partner-earnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payAllApproved = () => {
    const ids = earnings.filter((e) => e.status === "approved").map((e) => e.id);
    if (ids.length === 0) { toast.info("Nothing to pay"); return; }
    if (!confirm(`Pay ${ids.length} earnings (${money(stats.approved)})?`)) return;
    setStatusMut.mutate({ ids, status: "paid" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending Approval" value={money(stats.pending)} />
        <StatCard label="Approved (unpaid)" value={money(stats.approved)} />
        <StatCard label="Paid This Month" value={money(stats.paidMonth)} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Partner Earnings</CardTitle>
          <Button onClick={payAllApproved} disabled={setStatusMut.isPending || stats.approved === 0}>
            Pay All Approved
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <div>Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Ambassador</th><th>Campaign</th><th>Order</th>
                    <th>Revenue</th><th>%</th><th>Commission</th><th>Status</th><th>Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="py-2">{ambName(e.ambassador_id)}</td>
                      <td>{campName(e.campaign_id)}</td>
                      <td><code className="text-xs">{e.order_id?.slice(0, 8)}</code></td>
                      <td>{money(e.order_revenue)}</td>
                      <td>{Number(e.commission_pct)}%</td>
                      <td>{money(e.commission_amount)}</td>
                      <td><StatusBadge status={e.status} /></td>
                      <td>{new Date(e.created_at).toLocaleDateString()}</td>
                      <td className="space-x-1 whitespace-nowrap">
                        {e.status === "pending" && (
                          <Button size="sm" onClick={() => setStatusMut.mutate({ ids: [e.id], status: "approved" })}>
                            Approve
                          </Button>
                        )}
                        {e.status === "approved" && (
                          <Button size="sm" onClick={() => setStatusMut.mutate({ ids: [e.id], status: "paid" })}>
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {earnings.length === 0 && (
                    <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No earnings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default", approved: "default", paid: "default",
    pending: "secondary", draft: "secondary", paused: "outline",
    ended: "outline", cancelled: "destructive", terminated: "destructive",
  };
  return <Badge variant={variant[status] ?? "secondary"}>{status}</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4: Settlement — monthly payout breakdowns per partner
type PartnerProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean | null;
  pending_balance: number | null;
  total_paid_lifetime: number | null;
  total_earned_lifetime: number | null;
  status: string;
};
type PartnerPayout = {
  id: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  total_revenue: number | null;
  total_costs: number | null;
  net_profit: number | null;
  partner_share_pct: number | null;
  partner_earnings: number | null;
  wholesaler_referral_earnings: number | null;
  campaign_earnings: number | null;
  status: string;
  stripe_transfer_id: string | null;
  approved_at: string | null;
  paid_at: string | null;
};

function SettlementTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState<number>(now.getMonth() + 1);
  const [genYear, setGenYear] = useState<number>(now.getFullYear());
  const [genPartner, setGenPartner] = useState<string>("all");

  const { data: partners = [] } = useQuery({
    queryKey: ["dd-partner-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_partner_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PartnerProfile[];
    },
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ["dd-partner-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_partner_payouts")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PartnerPayout[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dd_partner_payouts")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout approved");
      qc.invalidateQueries({ queryKey: ["dd-partner-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async (p: PartnerPayout) => {
      const amount = Number(p.partner_earnings ?? 0);
      if (amount <= 0) throw new Error("Nothing to pay");
      const { data, error } = await supabase.functions.invoke("dd-pay-partner", {
        body: { payout_id: p.id, partner_id: p.partner_id, amount },
      });
      if (error) throw error;
      const result = data as { error?: string } | null;
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success("Payment processed");
      qc.invalidateQueries({ queryKey: ["dd-partner-payouts"] });
      qc.invalidateQueries({ queryKey: ["dd-partner-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async (vars: { month: number; year: number; partner_id?: string }) => {
      const body: Record<string, unknown> = { month: vars.month, year: vars.year, force: true };
      if (vars.partner_id && vars.partner_id !== "all") body.partner_id = vars.partner_id;
      const { data, error } = await supabase.functions.invoke("dd-generate-partner-payouts", { body });
      if (error) throw error;
      const r = data as { error?: string; payouts_created?: number; total_amount?: number; period?: string } | null;
      if (r?.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Generated ${r?.payouts_created ?? 0} payouts · $${(r?.total_amount ?? 0).toFixed(2)} · ${r?.period ?? ""}`);
      qc.invalidateQueries({ queryKey: ["dd-partner-payouts"] });
      qc.invalidateQueries({ queryKey: ["dd-partner-profiles"] });
      setGenOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PartnerPayout[]>();
    for (const p of payouts) {
      const arr = map.get(p.partner_id) ?? [];
      arr.push(p);
      map.set(p.partner_id, arr);
    }
    return map;
  }, [payouts]);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisMonthPayouts = payouts.filter((p) => p.period_start === monthStart);
  const monthStats = useMemo(() => {
    const stats = { partners: thisMonthPayouts.length, total: 0, calculating: 0, pending: 0, approved: 0, paid: 0 };
    for (const p of thisMonthPayouts) {
      stats.total += Number(p.partner_earnings ?? 0);
      if (p.status === "calculating") stats.calculating++;
      else if (p.status === "pending_review") stats.pending++;
      else if (p.status === "approved") stats.approved++;
      else if (p.status === "paid") stats.paid++;
    }
    return stats;
  }, [thisMonthPayouts]);

  const MONTH_OPTS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const generatorUI = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>💸 Monthly Payouts</span>
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Generate Payouts</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate Monthly Payouts</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Month</Label>
                  <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Partner</Label>
                  <Select value={genPartner} onValueChange={setGenPartner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => generate.mutate({ month: genMonth, year: genYear, partner_id: genPartner })}
                  disabled={generate.isPending}>
                  {generate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Generate"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div><div className="text-muted-foreground">Partners</div><div className="font-bold">{monthStats.partners}</div></div>
          <div><div className="text-muted-foreground">Total Owed</div><div className="font-bold text-green-600">{money(monthStats.total)}</div></div>
          <div><div className="text-muted-foreground">Calculating</div><div className="font-bold">{monthStats.calculating}</div></div>
          <div><div className="text-muted-foreground">Pending</div><div className="font-bold">{monthStats.pending}</div></div>
          <div><div className="text-muted-foreground">Approved</div><div className="font-bold">{monthStats.approved}</div></div>
          <div><div className="text-muted-foreground">Paid</div><div className="font-bold">{monthStats.paid}</div></div>
        </div>
      </CardContent>
    </Card>
  );

  if (!partners.length) {
    return (
      <div className="space-y-4">
        {generatorUI}
        <Card><CardContent className="p-6 text-muted-foreground">No partners yet.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {partners.map((partner) => {
        const list = grouped.get(partner.id) ?? [];
        return (
          <Card key={partner.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>{partner.full_name} <span className="text-sm font-normal text-muted-foreground">· {partner.email}</span></span>
                <span className="text-sm flex items-center gap-2">
                  {partner.stripe_connect_onboarded
                    ? <Badge>Stripe Connected</Badge>
                    : <Badge variant="outline">Not onboarded</Badge>}
                  <span className="text-muted-foreground">Pending: {money(partner.pending_balance)}</span>
                  <span className="text-muted-foreground">Paid LTD: {money(partner.total_paid_lifetime)}</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {list.length === 0
                ? <p className="text-sm text-muted-foreground">No payout periods yet.</p>
                : (
                  <div className="space-y-2">
                    {list.map((p) => (
                      <div key={p.id} className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-7 gap-2 items-center text-sm">
                        <div className="font-medium">{p.period_start} → {p.period_end}</div>
                        <div>Revenue: <b>{money(p.total_revenue)}</b></div>
                        <div>Costs: <b>{money(p.total_costs)}</b></div>
                        <div>Profit: <b>{money(p.net_profit)}</b></div>
                        <div>Owed: <b className="text-green-600">{money(p.partner_earnings)}</b></div>
                        <div><StatusBadge status={p.status} /></div>
                        <div className="flex gap-2 justify-end">
                          {(p.status === "calculating" || p.status === "pending_review") && (
                            <Button size="sm" variant="outline" disabled={approve.isPending}
                              onClick={() => approve.mutate(p.id)}>Approve</Button>
                          )}
                          {p.status === "approved" && (
                            <Button size="sm" disabled={pay.isPending || !partner.stripe_connect_onboarded}
                              onClick={() => pay.mutate(p)}>
                              {pay.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Process Payment"}
                            </Button>
                          )}
                          {p.status === "paid" && p.stripe_transfer_id && (
                            <span className="text-xs text-muted-foreground">{p.stripe_transfer_id}</span>
                          )}
                        </div>
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
