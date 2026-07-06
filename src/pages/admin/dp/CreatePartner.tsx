import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { dpWrite, fmtMoney } from "@/lib/dpClient";
import { SchemaNotExposedBanner, isSchemaNotExposedError } from "@/components/admin/SchemaNotExposedBanner";
import { DP_PLATFORMS, DP_TIERS, getTier, type DPTierValue } from "@/lib/dpTiers";

export default function CreatePartner() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tier, setTier] = useState<DPTierValue>("foundation");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [entryFeePaid, setEntryFeePaid] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tierDef = getTier(tier)!;
  const maxPlatforms = tierDef.maxPlatforms;

  const togglePlatform = (slug: string) => {
    setPlatforms((prev) => {
      if (prev.includes(slug)) return prev.filter((p) => p !== slug);
      if (prev.length >= maxPlatforms) {
        toast.error(`${tierDef.label} tier allows a maximum of ${maxPlatforms} platform${(maxPlatforms as number) === 1 ? "" : "s"}.`);
        return prev;
      }
      return [...prev, slug];
    });
  };

  const handleTierChange = (v: string) => {
    const next = v as DPTierValue;
    setTier(next);
    const nextMax = getTier(next)!.maxPlatforms;
    setPlatforms((prev) => (prev.length > nextMax ? prev.slice(0, nextMax) : prev));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full name and email are required.");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Select at least one platform.");
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      business_name: businessName.trim() || null,
      tier,
      status: "pending_onboarding",
      entry_fee_amount: tierDef.entryFeeCents,
      mrr_amount: tierDef.mrrCents,
      entry_fee_paid_at: entryFeePaid ? now : null,
      mrr_active_until: subscriptionActive
        ? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      profile_data: {
        platforms,
        admin_notes: notes.trim() || null,
        created_via: "admin_create_partner",
      },
    };

    const { error } = await dpWrite().from("partners").insert(payload);
    setSubmitting(false);

    if (error) {
      if (isSchemaNotExposedError(error)) {
        toast.error("Partners schema not exposed yet — writes are blocked until the backend schema list is updated.");
        return;
      }
      toast.error(error.message ?? "Failed to create partner");
      return;
    }

    toast.success(`${fullName} added as ${tierDef.label} partner — pending approval`);
    nav("/admin/partners");
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav("/admin/partners")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Partners
        </Button>
      </div>
      <h2 className="text-2xl font-bold">Create Partner</h2>
      <SchemaNotExposedBanner />

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business">Business name</Label>
              <Input id="business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tier</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={tier} onValueChange={handleTierChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DP_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} — {fmtMoney(t.entryFeeCents)} entry + {fmtMoney(t.mrrCents)}/mo · {t.commissionRate}% commission · up to {t.maxPlatforms} platform{(t.maxPlatforms as number) === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Entry fee and MRR are set from tier. Toggle the checkboxes below if the partner has already paid.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Platform activation ({platforms.length}/{maxPlatforms})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DP_PLATFORMS.map((p) => {
              const checked = platforms.includes(p.slug);
              const disabled = !checked && platforms.length >= maxPlatforms;
              return (
                <label
                  key={p.slug}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    checked ? "border-primary bg-primary/5" : "border-input"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}
                >
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => togglePlatform(p.slug)} />
                  <span>{p.label}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Billing status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={entryFeePaid} onCheckedChange={(v) => setEntryFeePaid(!!v)} />
              Entry fee paid ({fmtMoney(tierDef.entryFeeCents)})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={subscriptionActive} onCheckedChange={(v) => setSubscriptionActive(!!v)} />
              Monthly subscription active ({fmtMoney(tierDef.mrrCents)}/mo)
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal admin notes (optional)" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => nav("/admin/partners")}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Partner"}
          </Button>
        </div>
      </form>
    </div>
  );
}
