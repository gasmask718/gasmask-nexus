// Dynasty Direct — Credit Account Panel (admin management for a store)
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type CreditAccount = {
  id: string;
  store_account_id: string;
  user_id: string | null;
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  payment_terms: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  next_payment_due: string | null;
  days_past_due: number;
  total_paid_lifetime: number;
  created_at: string;
};

type CreditTx = {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

export function CreditAccountPanel({ storeAccountId }: { storeAccountId: string }) {
  const qc = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: account, isLoading } = useQuery({
    queryKey: ["dd-credit-account", storeAccountId],
    queryFn: async (): Promise<CreditAccount | null> => {
      const { data, error } = await supabase
        .from("dd_credit_accounts" as any)
        .select("*")
        .eq("store_account_id", storeAccountId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["dd-credit-tx", account?.id],
    enabled: !!account?.id,
    queryFn: async (): Promise<CreditTx[]> => {
      const { data, error } = await supabase
        .from("dd_credit_transactions" as any)
        .select("*")
        .eq("credit_account_id", account!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const suspend = useMutation({
    mutationFn: async () => {
      if (!account) return;
      const { error } = await supabase
        .from("dd_credit_accounts" as any)
        .update({ status: account.status === "suspended" ? "active" : "suspended" })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-credit-account", storeAccountId] });
      qc.invalidateQueries({ queryKey: ["dd-credit-overdue"] });
      toast.success("Credit status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading credit…</div>;

  if (!account) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          This store does not have credit terms.
        </div>
        <Button onClick={() => setApproveOpen(true)}>
          <CreditCard className="w-4 h-4 mr-2" /> Approve Credit
        </Button>
        <ApproveCreditDialog
          open={approveOpen}
          onClose={() => setApproveOpen(false)}
          storeAccountId={storeAccountId}
        />
      </div>
    );
  }

  const overdue = (account.days_past_due ?? 0) > 0;
  const dueSoon =
    !!account.next_payment_due &&
    new Date(account.next_payment_due) < new Date(Date.now() + 7 * 86400_000);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Credit Limit" value={`$${Number(account.credit_limit).toFixed(2)}`} />
        <StatBox label="Current Balance" value={`$${Number(account.current_balance).toFixed(2)}`} />
        <StatBox
          label="Available Credit"
          value={`$${Number(account.available_credit).toFixed(2)}`}
          tone="emerald"
        />
        <StatBox label="Terms" value={account.payment_terms.toUpperCase()} />
      </div>

      <div className="text-xs space-y-1">
        <div>
          Status:{" "}
          <Badge variant="outline" className="ml-1">
            {account.status}
          </Badge>
        </div>
        <div className={overdue ? "text-rose-600 font-semibold" : dueSoon ? "text-amber-600" : ""}>
          Next payment due: {account.next_payment_due ?? "—"}
          {overdue ? ` (${account.days_past_due} days past due)` : ""}
        </div>
        <div className="text-muted-foreground">
          Lifetime paid: ${Number(account.total_paid_lifetime).toFixed(2)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setPayOpen(true)}>Record Payment</Button>
        <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
          Adjust Limit / Terms
        </Button>
        <Button size="sm" variant="outline" onClick={() => suspend.mutate()}>
          {account.status === "suspended" ? "Reactivate" : "Suspend Credit"}
        </Button>
      </div>

      <div>
        <div className="text-xs uppercase text-muted-foreground mb-2">Transaction History</div>
        {txs.length === 0 ? (
          <div className="text-xs text-muted-foreground">No transactions yet.</div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{t.transaction_type}</TableCell>
                    <TableCell
                      className={`text-xs text-right ${
                        Number(t.amount) < 0 ? "text-emerald-600" : ""
                      }`}
                    >
                      ${Number(t.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {t.balance_after != null ? `$${Number(t.balance_after).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{t.due_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        creditAccountId={account.id}
        storeAccountId={storeAccountId}
      />
      <AdjustCreditDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        account={account}
        storeAccountId={storeAccountId}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ApproveCreditDialog({
  open,
  onClose,
  storeAccountId,
}: {
  open: boolean;
  onClose: () => void;
  storeAccountId: string;
}) {
  const qc = useQueryClient();
  const [creditLimit, setCreditLimit] = useState(1000);
  const [terms, setTerms] = useState("net30");

  const approve = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      // Look up linked user_id from store_accounts if present
      const { data: store } = await supabase
        .from("store_accounts" as any)
        .select("user_id")
        .eq("id", storeAccountId)
        .maybeSingle();

      const { error } = await supabase.from("dd_credit_accounts" as any).insert({
        store_account_id: storeAccountId,
        user_id: (store as any)?.user_id ?? null,
        credit_limit: creditLimit,
        payment_terms: terms,
        status: "active",
        approved_by: u.user?.id ?? null,
        approved_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-credit-account", storeAccountId] });
      qc.invalidateQueries({ queryKey: ["dd-credit-overdue"] });
      toast.success("Credit approved");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Credit Terms</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Credit Limit ($)</Label>
            <Input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Payment Terms</Label>
            <Select value={terms} onValueChange={setTerms}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="net15">Net 15</SelectItem>
                <SelectItem value="net30">Net 30</SelectItem>
                <SelectItem value="net60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  open,
  onClose,
  creditAccountId,
  storeAccountId,
}: {
  open: boolean;
  onClose: () => void;
  creditAccountId: string;
  storeAccountId: string;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const pay = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error("Amount must be greater than 0");
      const { data, error } = await supabase.rpc("dd_record_credit_payment" as any, {
        p_credit_account_id: creditAccountId,
        p_amount: amount,
        p_notes: notes || null,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (result && result.success === false) {
        throw new Error(result.error || "Payment failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-credit-account", storeAccountId] });
      qc.invalidateQueries({ queryKey: ["dd-credit-tx", creditAccountId] });
      qc.invalidateQueries({ queryKey: ["dd-credit-overdue"] });
      toast.success("Payment recorded");
      onClose();
      setAmount(0);
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Amount ($)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
            {pay.isPending ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustCreditDialog({
  open,
  onClose,
  account,
  storeAccountId,
}: {
  open: boolean;
  onClose: () => void;
  account: CreditAccount;
  storeAccountId: string;
}) {
  const qc = useQueryClient();
  const [limit, setLimit] = useState(Number(account.credit_limit));
  const [terms, setTerms] = useState(account.payment_terms);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("dd_credit_accounts" as any)
        .update({ credit_limit: limit, payment_terms: terms })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-credit-account", storeAccountId] });
      toast.success("Credit updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Credit Limit / Terms</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Credit Limit ($)</Label>
            <Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Payment Terms</Label>
            <Select value={terms} onValueChange={setTerms}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prepay">Prepay</SelectItem>
                <SelectItem value="net15">Net 15</SelectItem>
                <SelectItem value="net30">Net 30</SelectItem>
                <SelectItem value="net60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OverdueCreditAlert() {
  const { data: overdue = [] } = useQuery({
    queryKey: ["dd-credit-overdue"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("dd_credit_accounts" as any)
        .select("id, store_account_id, current_balance, next_payment_due, days_past_due")
        .eq("status", "active")
        .gt("current_balance", 0)
        .lt("next_payment_due", today);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  if (!overdue.length) return null;

  return (
    <div className="border border-rose-500/40 bg-rose-500/10 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-rose-700">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-semibold">
          {overdue.length} account{overdue.length === 1 ? "" : "s"} past due
        </span>
        <span className="text-rose-600/80">
          — total outstanding $
          {overdue.reduce((s, a: any) => s + Number(a.current_balance || 0), 0).toFixed(2)}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast.info("Reminder emails are queued via the public site billing job.")}
      >
        Send Reminders
      </Button>
    </div>
  );
}
