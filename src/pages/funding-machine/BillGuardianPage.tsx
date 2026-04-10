import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Shield, Plus, CreditCard, AlertTriangle, CheckCircle, Clock, DollarSign, Calendar } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  at_risk: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export default function BillGuardianPage() {
  const queryClient = useQueryClient();
  const [showAddBill, setShowAddBill] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billForm, setBillForm] = useState({
    bill_name: "", vendor: "", amount: "", due_date: "",
    frequency: "monthly", auto_pay_enabled: false, payment_card_id: "", notes: "",
  });
  const [cardForm, setCardForm] = useState({
    card_nickname: "", card_brand: "Visa", last4: "",
    available_balance: "", billing_threshold: "100", is_primary: false,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["funding-bills"],
    queryFn: async () => {
      const { data } = await supabase.from("funding_bills").select("*").order("due_date", { ascending: true });
      return data || [];
    },
  });

  const { data: cards = [] } = useQuery({
    queryKey: ["funding-payment-cards"],
    queryFn: async () => {
      const { data } = await supabase.from("funding_payment_cards").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addBill = useMutation({
    mutationFn: async () => {
      const card = cards.find((c: any) => c.id === billForm.payment_card_id);
      const { error } = await supabase.from("funding_bills").insert({
        bill_name: billForm.bill_name,
        vendor: billForm.vendor,
        amount: Number(billForm.amount),
        due_date: billForm.due_date,
        frequency: billForm.frequency,
        auto_pay_enabled: billForm.auto_pay_enabled,
        payment_card_id: billForm.payment_card_id || null,
        payment_card_last4: card?.last4 || null,
        payment_card_brand: card?.card_brand || null,
        notes: billForm.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funding-bills"] });
      setShowAddBill(false);
      setBillForm({ bill_name: "", vendor: "", amount: "", due_date: "", frequency: "monthly", auto_pay_enabled: false, payment_card_id: "", notes: "" });
      toast.success("Bill added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("funding_payment_cards").insert({
        card_nickname: cardForm.card_nickname,
        card_brand: cardForm.card_brand,
        last4: cardForm.last4,
        available_balance: Number(cardForm.available_balance),
        billing_threshold: Number(cardForm.billing_threshold),
        is_primary: cardForm.is_primary,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funding-payment-cards"] });
      setShowAddCard(false);
      setCardForm({ card_nickname: "", card_brand: "Visa", last4: "", available_balance: "", billing_threshold: "100", is_primary: false });
      toast.success("Card added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funding_bills").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funding-bills"] });
      toast.success("Bill marked as paid");
    },
  });

  const totalMonthly = bills.filter((b: any) => b.frequency === "monthly").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const autoPay = bills.filter((b: any) => b.auto_pay_enabled).length;
  const atRisk = bills.filter((b: any) => b.status === "at_risk").length;
  const next7Days = bills.filter((b: any) => {
    const due = new Date(b.due_date);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7 && b.status !== "paid";
  }).length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bill Guardian</h1>
            <p className="text-sm text-muted-foreground">Auto-Pay Monitoring & Balance Protection</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><CreditCard className="h-4 w-4 mr-1" /> Connect Card</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Connect Payment Card</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Card Nickname</Label><Input value={cardForm.card_nickname} onChange={e => setCardForm(p => ({ ...p, card_nickname: e.target.value }))} placeholder="Chase Freedom" /></div>
                <div><Label>Card Brand</Label>
                  <Select value={cardForm.card_brand} onValueChange={v => setCardForm(p => ({ ...p, card_brand: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Visa">Visa</SelectItem><SelectItem value="Mastercard">Mastercard</SelectItem><SelectItem value="Amex">Amex</SelectItem><SelectItem value="Discover">Discover</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Last 4 Digits</Label><Input value={cardForm.last4} onChange={e => setCardForm(p => ({ ...p, last4: e.target.value }))} maxLength={4} placeholder="1234" /></div>
                <div><Label>Available Balance ($)</Label><Input type="number" value={cardForm.available_balance} onChange={e => setCardForm(p => ({ ...p, available_balance: e.target.value }))} /></div>
                <div><Label>Alert Threshold ($)</Label><Input type="number" value={cardForm.billing_threshold} onChange={e => setCardForm(p => ({ ...p, billing_threshold: e.target.value }))} /></div>
                <div className="flex items-center gap-2"><Switch checked={cardForm.is_primary} onCheckedChange={v => setCardForm(p => ({ ...p, is_primary: v }))} /><Label>Primary Card</Label></div>
                <Button className="w-full" onClick={() => addCard.mutate()} disabled={!cardForm.card_nickname || !cardForm.last4}>Save Card</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddBill} onOpenChange={setShowAddBill}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Bill</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Bill</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                <div><Label>Bill Name *</Label><Input value={billForm.bill_name} onChange={e => setBillForm(p => ({ ...p, bill_name: e.target.value }))} placeholder="Electric Bill" /></div>
                <div><Label>Vendor</Label><Input value={billForm.vendor} onChange={e => setBillForm(p => ({ ...p, vendor: e.target.value }))} placeholder="FPL" /></div>
                <div><Label>Amount ($) *</Label><Input type="number" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div><Label>Due Date *</Label><Input type="date" value={billForm.due_date} onChange={e => setBillForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                <div><Label>Frequency</Label>
                  <Select value={billForm.frequency} onValueChange={v => setBillForm(p => ({ ...p, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Switch checked={billForm.auto_pay_enabled} onCheckedChange={v => setBillForm(p => ({ ...p, auto_pay_enabled: v }))} /><Label>Auto-Pay Enabled</Label></div>
                {billForm.auto_pay_enabled && cards.length > 0 && (
                  <div><Label>Payment Card</Label>
                    <Select value={billForm.payment_card_id} onValueChange={v => setBillForm(p => ({ ...p, payment_card_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                      <SelectContent>{cards.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.card_nickname} (****{c.last4})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label>Notes</Label><Textarea value={billForm.notes} onChange={e => setBillForm(p => ({ ...p, notes: e.target.value }))} /></div>
                <Button className="w-full" onClick={() => addBill.mutate()} disabled={!billForm.bill_name || !billForm.amount || !billForm.due_date}>Save Bill</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Monthly Obligations</div>
            <p className="text-2xl font-bold text-foreground">${totalMonthly.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CheckCircle className="h-3.5 w-3.5" /> Auto-Pay Bills</div>
            <p className="text-2xl font-bold text-foreground">{autoPay}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5 text-orange-400" /> At Risk</div>
            <p className="text-2xl font-bold text-orange-400">{atRisk}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" /> Due in 7 Days</div>
            <p className="text-2xl font-bold text-foreground">{next7Days}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Overview */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cards.map((c: any) => (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{c.card_nickname}</p>
                    <p className="text-xs text-muted-foreground">{c.card_brand} ****{c.last4}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">${Number(c.available_balance).toLocaleString()}</p>
                    {c.is_primary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bills Table */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground">All Bills</CardTitle></CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No bills tracked yet</p>
              <Button size="sm" className="mt-3" onClick={() => setShowAddBill(true)}><Plus className="h-4 w-4 mr-1" /> Add Your First Bill</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-2 pr-4">Bill</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Due Date</th>
                    <th className="pb-2 pr-4">Auto-Pay</th>
                    <th className="pb-2 pr-4">Card</th>
                    <th className="pb-2 pr-4">Balance OK</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill: any) => (
                    <tr key={bill.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedBill(bill)}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">{bill.bill_name}</p>
                        {bill.vendor && <p className="text-xs text-muted-foreground">{bill.vendor}</p>}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-foreground">${Number(bill.amount).toFixed(2)}</td>
                      <td className="py-3 pr-4 text-foreground">{bill.due_date}</td>
                      <td className="py-3 pr-4">{bill.auto_pay_enabled ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{bill.payment_card_brand ? `${bill.payment_card_brand} ****${bill.payment_card_last4}` : "—"}</td>
                      <td className="py-3 pr-4">{bill.card_sufficient ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}</td>
                      <td className="py-3 pr-4"><Badge className={STATUS_COLORS[bill.status] || STATUS_COLORS.upcoming}>{bill.status}</Badge></td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
                        {bill.status !== "paid" && <Button size="sm" variant="outline" onClick={() => markPaid.mutate(bill.id)}>Mark Paid</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* At-Risk Detail Drawer */}
      <Sheet open={!!selectedBill} onOpenChange={() => setSelectedBill(null)}>
        <SheetContent className="w-[400px] bg-card">
          <SheetHeader><SheetTitle className="text-foreground">Bill Details</SheetTitle></SheetHeader>
          {selectedBill && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-lg font-bold text-foreground">{selectedBill.bill_name}</p>
                {selectedBill.vendor && <p className="text-sm text-muted-foreground">{selectedBill.vendor}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Amount:</span><p className="font-semibold text-foreground">${Number(selectedBill.amount).toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Due Date:</span><p className="font-semibold text-foreground">{selectedBill.due_date}</p></div>
                <div><span className="text-muted-foreground">Frequency:</span><p className="text-foreground capitalize">{selectedBill.frequency}</p></div>
                <div><span className="text-muted-foreground">Status:</span><Badge className={STATUS_COLORS[selectedBill.status]}>{selectedBill.status}</Badge></div>
              </div>
              {selectedBill.auto_pay_enabled && (
                <Card className="bg-muted/30 border-border">
                  <CardContent className="pt-3 pb-3 text-sm">
                    <p className="font-semibold text-foreground mb-1">Auto-Pay Details</p>
                    <p className="text-muted-foreground">Card: {selectedBill.payment_card_brand || "None"} ****{selectedBill.payment_card_last4 || "N/A"}</p>
                    <p className="text-muted-foreground">Balance Sufficient: {selectedBill.card_sufficient ? "✅ Yes" : "❌ No"}</p>
                  </CardContent>
                </Card>
              )}
              {selectedBill.status === "at_risk" && (
                <Card className="bg-orange-500/10 border-orange-500/30">
                  <CardContent className="pt-3 pb-3 text-sm">
                    <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-orange-400" /><p className="font-semibold text-orange-400">At Risk</p></div>
                    <p className="text-muted-foreground">The linked card's available balance may be insufficient to cover this bill. Update the card balance or switch to a different card.</p>
                  </CardContent>
                </Card>
              )}
              {selectedBill.confirmation_number && (
                <div className="text-sm"><span className="text-muted-foreground">Confirmation #:</span><p className="text-foreground font-mono">{selectedBill.confirmation_number}</p></div>
              )}
              {selectedBill.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes:</span><p className="text-foreground">{selectedBill.notes}</p></div>
              )}
              {selectedBill.status !== "paid" && (
                <Button className="w-full" onClick={() => { markPaid.mutate(selectedBill.id); setSelectedBill(null); }}>Mark as Paid</Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
