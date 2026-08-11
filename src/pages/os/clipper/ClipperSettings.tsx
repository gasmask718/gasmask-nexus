import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExternalLink, Save } from "lucide-react";

const GOLD = "#C9A84C";

const BUSINESS_BADGE: Record<string, string> = {
  gasmask:         "bg-orange-500/15 text-orange-300 border-orange-500/30",
  brandaro:        "bg-blue-500/15 text-blue-300 border-blue-500/30",
  toptier:         "bg-purple-500/15 text-purple-300 border-purple-500/30",
  uft:             "bg-pink-500/15 text-pink-300 border-pink-500/30",
  playboxxx:       "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  iclean:          "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  dynasty_connect: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  uben:            "bg-green-500/15 text-green-300 border-green-500/30",
};

const BUSINESS_LABEL: Record<string, string> = {
  gasmask: "GasMask",
  brandaro: "Brandaro",
  toptier: "TopTier",
  uft: "Unforgettable Times",
  playboxxx: "Playboxxx",
  iclean: "iClean WeClean",
  dynasty_connect: "Dynasty Connect",
  uben: "UBEN",
};

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-green-500/15 text-green-300 border-green-500/30",
  paused:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  draft:     "bg-muted text-muted-foreground border-border",
};

const PLATFORMS = [
  { key: "tiktok",    label: "TikTok",    badge: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  { key: "instagram", label: "Instagram", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { key: "youtube",   label: "YouTube",   badge: "bg-red-500/15 text-red-300 border-red-500/30" },
  { key: "twitter",   label: "Twitter",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
] as const;

export default function ClipperSettings() {
  const qc = useQueryClient();

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ["clipper-settings-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_campaigns")
        .select("id, brand_name, dynasty_business, base_rate_per_1k, commission_rate, status")
        .order("brand_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "base_rate_per_1k" | "commission_rate"; value: number }) => {
      const { error } = await (supabase as any)
        .from("clipper_campaigns")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["clipper-settings-campaigns"] });
      qc.invalidateQueries({ queryKey: ["clipper-campaigns"] });
      toast.success(vars.field === "base_rate_per_1k" ? "Rate updated" : "Commission updated");
    },
    onError: (e: any) => toast.error("Save failed: " + (e?.message || "unknown")),
  });

  const [platformState, setPlatformState] = useState<Record<string, boolean>>({
    tiktok: true, instagram: true, youtube: true, twitter: true,
  });

  const handlePlatformToggle = (key: string) => {
    toast.info("Platform toggle coming in Phase 2. Contact david@dynastyconnect.com to disable a platform.");
    setPlatformState((s) => ({ ...s, [key]: s[key] }));
  };

  const [minPayout, setMinPayout] = useState<number>(50);
  const [schedule, setSchedule] = useState<string>("weekly");

  const saveMinPayout = () => {
    toast.info("Minimum payout is not saved yet — coming in Phase 5. Contact david@dynastyconnect.com to change it.");
  };
  const saveSchedule = () => {
    toast.info("Payout schedule is not saved yet — coming in Phase 5. Contact david@dynastyconnect.com to change it.");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>⚙️ Settings</h1>
        <p className="text-sm text-muted-foreground">Commission rates, platform toggles, integrations, and payout rules.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Commission Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-sm text-red-300 mb-3">Error loading campaigns: {(error as Error).message}</div>}
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (campaigns || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No campaigns yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                    <th className="text-left py-2 px-2">Brand</th>
                    <th className="text-left py-2 px-2">Business</th>
                    <th className="text-right py-2 px-2 w-32">Rate / 1K ($)</th>
                    <th className="text-right py-2 px-2 w-32">Commission (%)</th>
                    <th className="text-left py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns || []).map((c: any) => (
                    <RateRow key={c.id} c={c}
                      onSave={(field, value) => updateField.mutate({ id: c.id, field, value })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Platform Toggles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORMS.map((p) => (
              <div key={p.key} className="border border-border/40 rounded-md p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <Badge variant="outline" className={cn("text-xs", p.badge)}>
                    {platformState[p.key] ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <Switch
                  checked={platformState[p.key]}
                  onCheckedChange={() => handlePlatformToggle(p.key)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-muted/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            Phyllo API — Social Metrics
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">Not Connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add <code className="text-xs bg-muted px-1 py-0.5 rounded">PHYLLO_CLIENT_ID</code> and{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">PHYLLO_SECRET</code> to your backend vault
            to enable automatic view tracking.
          </p>
          <a href="https://phyllo.com" target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-blue-300 hover:underline">
            phyllo.com <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Payout Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Minimum payout ($)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={minPayout}
                onChange={(e) => setMinPayout(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <Button onClick={saveMinPayout} variant="outline" size="sm">
              <Save className="h-3 w-3 mr-2" /> Save
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Payout schedule</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly (Friday)</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveSchedule} variant="outline" size="sm">
              <Save className="h-3 w-3 mr-2" /> Save
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Both settings are placeholders. Real payout automation ships with Stripe Connect Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RateRow({ c, onSave }: {
  c: any;
  onSave: (field: "base_rate_per_1k" | "commission_rate", value: number) => void;
}) {
  const [rate, setRate] = useState<string>(
    c.base_rate_per_1k != null ? Number(c.base_rate_per_1k).toFixed(2) : ""
  );
  const [comm, setComm] = useState<string>(
    c.commission_rate != null ? Number(c.commission_rate).toString() : ""
  );

  const commitRate = () => {
    const n = parseFloat(rate);
    if (isNaN(n)) { setRate(c.base_rate_per_1k != null ? Number(c.base_rate_per_1k).toFixed(2) : ""); return; }
    if (n === Number(c.base_rate_per_1k)) return;
    onSave("base_rate_per_1k", n);
  };
  const commitComm = () => {
    const n = parseFloat(comm);
    if (isNaN(n)) { setComm(c.commission_rate != null ? Number(c.commission_rate).toString() : ""); return; }
    if (n === Number(c.commission_rate)) return;
    onSave("commission_rate", n);
  };

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20">
      <td className="py-2 px-2 font-medium">{c.brand_name}</td>
      <td className="py-2 px-2">
        {c.dynasty_business && (
          <Badge variant="outline" className={cn("text-xs", BUSINESS_BADGE[c.dynasty_business] || "")}>
            {BUSINESS_LABEL[c.dynasty_business] || c.dynasty_business}
          </Badge>
        )}
      </td>
      <td className="py-2 px-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onBlur={commitRate}
          className="w-28 text-right tabular-nums"
        />
      </td>
      <td className="py-2 px-2">
        <Input
          type="number"
          step="0.1"
          min="0"
          value={comm}
          onChange={(e) => setComm(e.target.value)}
          onBlur={commitComm}
          className="w-28 text-right tabular-nums"
        />
      </td>
      <td className="py-2 px-2">
        <Badge variant="outline" className={cn("text-xs capitalize", STATUS_BADGE[c.status] || "")}>
          {c.status || "—"}
        </Badge>
      </td>
    </tr>
  );
}
