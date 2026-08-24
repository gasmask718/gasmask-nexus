/**
 * CallListBuilder — store book → campaign → queue.
 *
 * The power dialer used to show only a hand-built queue (126 numbers)
 * while the store book holds 1,300+ callable stores. This panel lets a
 * VA or admin build a calling set from filters (owes money, needs
 * product, lapsed, never ordered, no answer yet, by wave, by area),
 * preview the count BEFORE committing ("This list has 255 stores.
 * Start calling?"), then create a dialer_campaign + load
 * outbound_call_queue so the existing engine can dial it.
 *
 * All data comes from dialer-call-list-builder (service role, JWT +
 * role gated). Suppression (dnc_list + opt_out_events) is applied at
 * build time and re-checked fail-closed at dial time.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign, Package, Clock, Sparkles, PhoneMissed, Waves, MapPin,
  ListPlus, Loader2, ShieldBan, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface PresetsData {
  counts: Record<string, number>;
  waves: { segment: string; count: number }[];
  areas: Record<"borough" | "corridor" | "neighborhood", { value: string; count: number }[]>;
  suppressed_total: number;
  already_dialing_total: number;
}

interface PreviewData {
  count: number;
  suppressed: number;
  already_dialing: number;
  no_phone: number;
  sample: { store_name: string; contact_name: string | null; phone: string; context: string }[];
}

const PRESETS = [
  { key: "owes_money", label: "Owes money", icon: DollarSign, tone: "text-destructive", desc: "Biggest balance first" },
  { key: "needs_product", label: "Needs product", icon: Package, tone: "text-amber-500", desc: "Out of stock / at reorder point" },
  { key: "lapsed", label: "Lapsed", icon: Clock, tone: "text-muted-foreground", desc: "No order in over a year" },
  { key: "never_ordered", label: "Never ordered", icon: Sparkles, tone: "text-primary", desc: "Prospects" },
  { key: "no_answer", label: "No answer yet", icon: PhoneMissed, tone: "text-muted-foreground", desc: "Never successfully reached" },
  { key: "wave", label: "By wave", icon: Waves, tone: "text-primary", desc: "Text-campaign segments A–D" },
  { key: "area", label: "By area", icon: MapPin, tone: "text-primary", desc: "Corridor, neighbourhood or borough" },
] as const;

async function invokeBuilder<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("dialer-call-list-builder", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    throw new Error(details);
  }
  return data as T;
}

export function CallListBuilder({
  businessId,
  onCampaignCreated,
}: {
  businessId?: string | null;
  onCampaignCreated: (campaignId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<string>("owes_money");
  const [segment, setSegment] = useState<string>("A ACTIVE");
  const [areaField, setAreaField] = useState<"corridor" | "neighborhood" | "borough">("corridor");
  const [areaValue, setAreaValue] = useState<string>("");
  const [name, setName] = useState<string>("");

  const filterBody = () => ({
    preset,
    ...(preset === "wave" ? { segment } : {}),
    ...(preset === "area" ? { area_field: areaField, area_value: areaValue } : {}),
  });

  const presetsQuery = useQuery({
    queryKey: ["dialer-call-list-presets"],
    queryFn: () => invokeBuilder<PresetsData>({ action: "presets" }),
    staleTime: 60_000,
  });

  const previewQuery = useQuery({
    queryKey: ["dialer-call-list-preview", preset, segment, areaField, areaValue],
    queryFn: () => invokeBuilder<PreviewData>({ action: "preview", ...filterBody() }),
    enabled: preset !== "area" || !!areaValue,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      invokeBuilder<{ campaign_id: string; name: string; queued: number; suppressed: number; already_dialing: number; no_phone: number }>(
        { action: "create", ...filterBody(), name: name.trim() || undefined, business_id: businessId || undefined },
      ),
    onSuccess: (data) => {
      toast.success(`Campaign "${data.name}" created — ${data.queued} stores loaded into the queue`, {
        description: `${data.suppressed} suppressed skipped · ${data.already_dialing} already dialing · ${data.no_phone} without a phone`,
      });
      queryClient.invalidateQueries({ queryKey: ["power-dialer-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dialer-call-list-presets"] });
      queryClient.invalidateQueries({ queryKey: ["dialer-call-list-preview"] });
      onCampaignCreated(data.campaign_id);
    },
    onError: (e: Error) => toast.error(`Could not build list: ${e.message}`),
  });

  const preview = previewQuery.data;
  const counts = presetsQuery.data?.counts || {};
  const areaOptions = presetsQuery.data?.areas?.[areaField] || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListPlus className="h-4 w-4" /> Build a call list
            </CardTitle>
            <CardDescription>
              Draw a calling set from the store book — it becomes a campaign and loads the queue.
            </CardDescription>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => presetsQuery.refetch()}
            disabled={presetsQuery.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${presetsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset picker */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const active = preset === p.key;
            const count = p.key === "wave" || p.key === "area" ? null : counts[p.key];
            return (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className={`h-3.5 w-3.5 ${p.tone}`} />
                  {p.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                {count != null && (
                  <div className="text-lg font-bold mt-1">
                    {presetsQuery.isLoading ? "…" : count}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-filters */}
        {preset === "wave" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Segment</span>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(presetsQuery.data?.waves || []).map((w) => (
                  <SelectItem key={w.segment} value={w.segment}>
                    {w.segment} ({w.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {preset === "area" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={areaField} onValueChange={(v) => { setAreaField(v as typeof areaField); setAreaValue(""); }}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corridor">Corridor</SelectItem>
                <SelectItem value="neighborhood">Neighbourhood</SelectItem>
                <SelectItem value="borough">Borough</SelectItem>
              </SelectContent>
            </Select>
            <Select value={areaValue} onValueChange={setAreaValue}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Pick an area…" /></SelectTrigger>
              <SelectContent>
                {areaOptions.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.value} ({a.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Preview */}
        {previewQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Counting the store book…
          </div>
        )}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                This list has <span className="text-lg font-bold">{preview.count}</span> stores.
              </span>
              {preview.suppressed > 0 && (
                <Badge variant="outline" className="gap-1">
                  <ShieldBan className="h-3 w-3" /> {preview.suppressed} suppressed — skipped
                </Badge>
              )}
              {preview.already_dialing > 0 && (
                <Badge variant="outline">{preview.already_dialing} already in a live queue</Badge>
              )}
              {preview.no_phone > 0 && (
                <Badge variant="outline">{preview.no_phone} without a phone</Badge>
              )}
            </div>

            {preview.sample.length > 0 && (
              <div className="rounded-md border border-border divide-y divide-border max-h-56 overflow-y-auto">
                {preview.sample.slice(0, 8).map((r, i) => (
                  <div key={i} className="px-3 py-2 text-sm flex items-baseline gap-2">
                    <span className="font-medium truncate">{r.store_name}</span>
                    <span className="text-muted-foreground truncate">
                      {r.contact_name ? `${r.contact_name} · ` : ""}{r.phone}
                    </span>
                    <span className="text-xs text-muted-foreground truncate ml-auto hidden md:inline">
                      {r.context}
                    </span>
                  </div>
                ))}
                {preview.count > 8 && (
                  <div className="px-3 py-1.5 text-xs text-muted-foreground">
                    …and {preview.count - 8} more
                  </div>
                )}
              </div>
            )}

            {/* Commit */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign name (optional)"
                className="max-w-xs"
              />
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || preview.count === 0}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Loading queue…</>
                ) : (
                  <>Start calling — create campaign &amp; load {preview.count} numbers</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
