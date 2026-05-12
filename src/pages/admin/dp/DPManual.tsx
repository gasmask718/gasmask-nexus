import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dp, logAdminAction } from "@/lib/dpClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function DPManual() {
  const qc = useQueryClient();
  const { data: partners } = useQuery({
    queryKey: ["dp-manual-partners"],
    queryFn: async () => (await dp().from("partners").select("id, full_name, email")).data ?? [],
  });
  const { data: platforms } = useQuery({
    queryKey: ["dp-manual-platforms"],
    queryFn: async () => (await dp().from("platforms").select("id, name")).data ?? [],
  });

  // Adjust commission rate
  const [partnerId, setPartnerId] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [rate, setRate] = useState("0.30");
  const [reason, setReason] = useState("");
  const adjustMut = useMutation({
    mutationFn: async () => {
      if (!partnerId || !platformId || !reason) throw new Error("Partner, platform, and reason required");
      const { error } = await dp().from("partner_platforms")
        .update({ custom_commission_rate: Number(rate) })
        .eq("partner_id", partnerId).eq("platform_id", platformId);
      if (error) throw error;
      await logAdminAction({
        action: "commission_rate_adjusted", entity_type: "partner_platform",
        partner_id: partnerId,
        metadata: { platform_id: platformId, new_rate: Number(rate), reason },
      });
    },
    onSuccess: () => { toast.success("Commission rate adjusted"); setReason(""); },
    onError: (e: any) => toast.error(e.message),
  });

  // Manual sale entry
  const [ambId, setAmbId] = useState("");
  const [salePlatform, setSalePlatform] = useState("");
  const [extId, setExtId] = useState("");
  const [amount, setAmount] = useState("");
  const saleMut = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100);
      if (!ambId || !salePlatform || !extId || !amountCents) throw new Error("All sale fields required");
      const { data: amb } = await dp().from("ambassadors").select("partner_id").eq("id", ambId).single();
      const platform = (platforms ?? []).find((p: any) => p.id === salePlatform);
      const { data: plat } = await dp().from("platforms").select("commission_pool_rate").eq("id", salePlatform).single();
      const pool = Math.round(amountCents * Number(plat?.commission_pool_rate ?? 0.3));
      const { error } = await dp().from("sales").insert({
        ambassador_id: ambId, partner_id: amb!.partner_id, platform_id: salePlatform,
        external_sale_id: extId, amount_cents: amountCents, commission_pool_cents: pool,
        status: "completed", sold_at: new Date().toISOString(),
      });
      if (error) throw error;
      await logAdminAction({
        action: "manual_sale_created", entity_type: "sale",
        partner_id: amb!.partner_id,
        metadata: { ambassador_id: ambId, amount_cents: amountCents, platform: platform?.name },
      });
    },
    onSuccess: () => { toast.success("Sale created — commission split auto-generated"); setExtId(""); setAmount(""); },
    onError: (e: any) => toast.error(e.message),
  });

  // Reset partner password
  const [resetEmail, setResetEmail] = useState("");
  const resetMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logAdminAction({ action: "partner_password_reset_sent", metadata: { email: resetEmail } });
    },
    onSuccess: () => { toast.success("Reset email sent"); setResetEmail(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Manual Tools</h2>

      <Card>
        <CardHeader><CardTitle>Adjust commission rate (with reason)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger><SelectValue placeholder="Partner" /></SelectTrigger>
              <SelectContent>{(partners ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={platformId} onValueChange={setPlatformId}>
              <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>{(platforms ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="0.01" min="0" max="1" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate (0–1)" />
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment (logged)" />
          <Button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending}>Apply adjustment</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Create manual sale (offline conversion)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Input value={ambId} onChange={(e) => setAmbId(e.target.value)} placeholder="Ambassador ID" />
            <Select value={salePlatform} onValueChange={setSalePlatform}>
              <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>{(platforms ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={extId} onChange={(e) => setExtId(e.target.value)} placeholder="External sale ID" />
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (USD)" />
          </div>
          <Button onClick={() => saleMut.mutate()} disabled={saleMut.isPending}>Create sale + auto-split</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Send password reset</CardTitle></CardHeader>
        <CardContent className="flex gap-3 items-end">
          <div className="flex-1">
            <Label>Partner email</Label>
            <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          </div>
          <Button onClick={() => resetMut.mutate()} disabled={resetMut.isPending || !resetEmail}>Send reset link</Button>
        </CardContent>
      </Card>
    </div>
  );
}
