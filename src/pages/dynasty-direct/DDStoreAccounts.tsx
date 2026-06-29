// Dynasty Direct — Store Accounts (retail stores at store pricing tier)
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CreditAccountPanel, OverdueCreditAlert } from "@/components/dynasty-direct/CreditAccountPanel";
import { LoyaltyPanel } from "@/components/dynasty-direct/LoyaltyPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus, Eye, Edit, Ban, ClipboardList, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AdminProSubscriptionPanel from "@/components/dynasty-direct/AdminProSubscriptionPanel";

type StoreAccount = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  pricing_tier: string;
  payment_terms: string;
  store_type: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_at: string | null;
  status: string;
  ambassador_id: string | null;
  address: string | null;
  zip: string | null;
  notes: string | null;
  credit_limit: number;
  created_at: string;
  user_id?: string | null;
};

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40",
  pending: "bg-amber-500/20 text-amber-700 border-amber-500/40",
  suspended: "bg-rose-500/20 text-rose-700 border-rose-500/40",
  closed: "bg-zinc-500/20 text-zinc-700 border-zinc-500/40",
};

export default function DDStoreAccounts() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<StoreAccount | null>(null);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["dd-store-accounts"],
    queryFn: async (): Promise<StoreAccount[]> => {
      const { data, error } = await supabase
        .from("store_accounts" as any)
        .select("*")
        .order("total_spent", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const { data: proSubs = [] } = useQuery({
    queryKey: ["dd-pro-sub-stats"],
    queryFn: async (): Promise<Array<{ store_account_id: string | null; status: string; monthly_price: number; cancelled_at: string | null }>> => {
      const { data, error } = await (supabase as any)
        .from("dd_pro_subscriptions")
        .select("store_account_id,status,monthly_price,cancelled_at");
      if (error) throw error;
      return data || [];
    },
  });

  const proStats = useMemo(() => {
    const active = proSubs.filter((s) => s.status === "active");
    const trial = proSubs.filter((s) => s.status === "trial");
    const mrr = active.reduce((sum, s) => sum + Number(s.monthly_price || 0), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const churned = proSubs.filter((s) => s.status === "cancelled" && s.cancelled_at && new Date(s.cancelled_at) >= monthStart).length;
    const activeStoreIds = new Set(active.map((s) => s.store_account_id).filter(Boolean) as string[]);
    return { activeCount: active.length, trialCount: trial.length, mrr, churned, activeStoreIds };
  }, [proSubs]);

  const stats = useMemo(() => {
    const active = stores.filter((s) => s.status === "active").length;
    const revenue = stores.reduce((sum, s) => sum + Number(s.total_spent || 0), 0);
    const aovs = stores.filter((s) => Number(s.avg_order_value) > 0).map((s) => Number(s.avg_order_value));
    const aov = aovs.length ? aovs.reduce((a, b) => a + b, 0) / aovs.length : 0;
    return { total: stores.length, active, revenue, aov };
  }, [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (statusTab === "pro") {
        if (!proStats.activeStoreIds.has(s.id)) return false;
      } else if (statusTab !== "all" && s.status !== statusTab) {
        return false;
      }
      if (filter) {
        const q = filter.toLowerCase();
        return (
          s.business_name.toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [stores, filter, statusTab, proStats.activeStoreIds]);

  const suspend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_accounts" as any)
        .update({ status: "suspended" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-store-accounts"] });
      toast.success("Store suspended");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">🏪 Store Accounts</h1>
            <p className="text-sm text-muted-foreground">
              Retail stores ordering at store pricing tier
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Store
        </Button>
      </div>

      <OverdueCreditAlert />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Stores" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Total Revenue" value={`$${stats.revenue.toFixed(2)}`} />
        <StatCard label="Avg Order" value={`$${stats.aov.toFixed(2)}`} />
      </div>

      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-sm font-semibold">Dynasty Direct Pro Revenue</div>
                <div className="text-xs text-muted-foreground">$97/mo subscription program</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6 text-sm">
              <div><div className="text-xs uppercase text-muted-foreground">Active subs</div><div className="text-xl font-bold">{proStats.activeCount}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">MRR</div><div className="text-xl font-bold">${proStats.mrr.toFixed(0)}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Trials</div><div className="text-xl font-bold">{proStats.trialCount}</div></div>
              <div><div className="text-xs uppercase text-muted-foreground">Churned</div><div className="text-xl font-bold">{proStats.churned}</div></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="suspended">Suspended</TabsTrigger>
                <TabsTrigger value="pro">⭐ Pro Subscribers ({proStats.activeCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              placeholder="Search by name or email…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sm:w-72"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No store accounts yet. Click <strong>Add Store</strong> to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>City/State</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.business_name}</TableCell>
                    <TableCell className="text-xs">
                      <div>{s.contact_name ?? "—"}</div>
                      <div className="text-muted-foreground">{s.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.pricing_tier}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.total_orders}</TableCell>
                    <TableCell className="text-right">${Number(s.total_spent).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      {s.last_order_at ? new Date(s.last_order_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[s.status]} variant="outline">
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(s)} title="View">
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" asChild title="Orders">
                          <Link to={`/dynasty-direct/orders?store=${s.id}`}>
                            <ClipboardList className="w-3 h-3" />
                          </Link>
                        </Button>
                        {s.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => suspend.mutate(s.id)}
                            title="Suspend"
                          >
                            <Ban className="w-3 h-3 text-rose-600" />
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

      <CreateStoreDialog open={creating} onClose={() => setCreating(false)} />

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.business_name}</SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="details" className="mt-6">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="credit">💳 Credit Account</TabsTrigger>
                  <TabsTrigger value="loyalty">🏆 Loyalty</TabsTrigger>
                  <TabsTrigger value="delivery">🚗 Delivery</TabsTrigger>
                  <TabsTrigger value="pro">📊 Pro</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <div className="space-y-4 mt-4 text-sm">
                    <DetailRow k="Contact" v={viewing.contact_name} />
                    <DetailRow k="Email" v={viewing.email} />
                    <DetailRow k="Phone" v={viewing.phone} />
                    <DetailRow k="Address" v={viewing.address} />
                    <DetailRow k="City/State/Zip" v={[viewing.city, viewing.state, viewing.zip].filter(Boolean).join(", ")} />
                    <DetailRow k="Store Type" v={viewing.store_type} />
                    <DetailRow k="Pricing Tier" v={viewing.pricing_tier} />
                    <DetailRow k="Payment Terms" v={viewing.payment_terms} />
                    <DetailRow k="Credit Limit" v={`$${Number(viewing.credit_limit).toFixed(2)}`} />
                    <DetailRow k="Total Orders" v={String(viewing.total_orders)} />
                    <DetailRow k="Total Spent" v={`$${Number(viewing.total_spent).toFixed(2)}`} />
                    <DetailRow k="Avg Order Value" v={`$${Number(viewing.avg_order_value).toFixed(2)}`} />
                    <DetailRow k="Last Order" v={viewing.last_order_at ? new Date(viewing.last_order_at).toLocaleString() : "—"} />
                    <DetailRow k="Status" v={viewing.status} />
                    <DetailRow k="Notes" v={viewing.notes} />
                  </div>
                </TabsContent>
                <TabsContent value="credit">
                  <div className="mt-4">
                    <CreditAccountPanel storeAccountId={viewing.id} />
                  </div>
                </TabsContent>
                <TabsContent value="loyalty">
                  <LoyaltyPanel storeAccountId={viewing.id} userId={null} />
                </TabsContent>
                <TabsContent value="delivery">
                  <DeliveryPreferencesPanel storeAccountId={viewing.id} />
                </TabsContent>
                <TabsContent value="pro">
                  <AdminProSubscriptionPanel storeAccountId={viewing.id} storeUserId={viewing.user_id ?? null} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b pb-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="col-span-2">{v || "—"}</div>
    </div>
  );
}

function DeliveryPreferencesPanel({ storeAccountId }: { storeAccountId: string }) {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["dd-store-delivery", storeAccountId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_accounts")
        .select("preferred_delivery,delivery_address,delivery_city,delivery_state,delivery_zip,delivery_window,delivery_notes,address,city,state,zip")
        .eq("id", storeAccountId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [form, setForm] = useState<any>(null);
  const current = form ?? prefs;

  const save = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await (supabase as any).from("store_accounts").update(patch).eq("id", storeAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery preferences saved");
      qc.invalidateQueries({ queryKey: ["dd-store-delivery", storeAccountId] });
      setForm(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (isLoading || !prefs) return <div className="text-sm text-muted-foreground mt-4">Loading…</div>;

  const method: "shipping" | "local_delivery" = (current?.preferred_delivery as any) ?? "shipping";

  return (
    <div className="space-y-4 mt-4 text-sm">
      <div>
        <Label>Preferred method</Label>
        <div className="flex gap-3 mt-2">
          {(["shipping", "local_delivery"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="preferred_delivery"
                value={m}
                checked={method === m}
                onChange={() => setForm({ ...current, preferred_delivery: m })}
              />
              {m === "shipping" ? "📦 Shipping" : "🚗 Local Delivery"}
            </label>
          ))}
        </div>
      </div>

      {method === "local_delivery" && (
        <div className="space-y-3 border rounded-md p-3 bg-muted/30">
          <div>
            <Label>Delivery address</Label>
            <Input
              placeholder={current?.address ?? "Same as store address"}
              value={current?.delivery_address ?? ""}
              onChange={(e) => setForm({ ...current, delivery_address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="City" value={current?.delivery_city ?? ""}
              onChange={(e) => setForm({ ...current, delivery_city: e.target.value })} />
            <Input placeholder="State" value={current?.delivery_state ?? ""}
              onChange={(e) => setForm({ ...current, delivery_state: e.target.value })} />
            <Input placeholder="Zip" value={current?.delivery_zip ?? ""}
              onChange={(e) => setForm({ ...current, delivery_zip: e.target.value })} />
          </div>
          <div>
            <Label>Preferred window</Label>
            <Select value={current?.delivery_window ?? ""} onValueChange={(v) => setForm({ ...current, delivery_window: v })}>
              <SelectTrigger><SelectValue placeholder="Select window" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Morning (9am-12pm)">Morning (9am–12pm)</SelectItem>
                <SelectItem value="Afternoon (12pm-5pm)">Afternoon (12pm–5pm)</SelectItem>
                <SelectItem value="Anytime">Anytime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Delivery notes</Label>
            <Textarea
              placeholder="e.g. Back entrance, ask for Maria"
              value={current?.delivery_notes ?? ""}
              onChange={(e) => setForm({ ...current, delivery_notes: e.target.value })}
            />
          </div>
        </div>
      )}

      <Button
        onClick={() => save.mutate({
          preferred_delivery: current?.preferred_delivery ?? "shipping",
          delivery_address: current?.delivery_address ?? null,
          delivery_city: current?.delivery_city ?? null,
          delivery_state: current?.delivery_state ?? null,
          delivery_zip: current?.delivery_zip ?? null,
          delivery_window: current?.delivery_window ?? null,
          delivery_notes: current?.delivery_notes ?? null,
        })}
        disabled={save.isPending || !form}
      >
        {save.isPending ? "Saving…" : "Save Preferences"}
      </Button>
    </div>
  );
}

function CreateStoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    store_type: "retail",
    pricing_tier: "store",
    payment_terms: "net30",
    credit_limit: 0,
    notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.business_name.trim()) throw new Error("Business name required");
      const { error } = await supabase.from("store_accounts" as any).insert(form as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-store-accounts"] });
      toast.success("Store created");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Store Account</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business Name *">
            <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </Field>
          <Field label="Contact Name">
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Address" className="col-span-2">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="Zip">
            <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </Field>
          <Field label="Store Type">
            <Select value={form.store_type} onValueChange={(v) => setForm({ ...form, store_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["retail", "restaurant", "hotel", "event_venue", "online", "other"].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pricing Tier">
            <Select value={form.pricing_tier} onValueChange={(v) => setForm({ ...form, pricing_tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["store", "wholesale", "vip"].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment Terms">
            <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["prepay", "net15", "net30", "net60"].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Credit Limit ($)">
            <Input
              type="number"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create Store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
