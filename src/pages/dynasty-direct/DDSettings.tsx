// Dynasty Direct — Settings (dd_config editor)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  id: boolean;
  default_margin_pct: number | null;
  default_reserve_pct: number | null;
  reserve_hold_days: number | null;
  low_stock_threshold: number | null;
  grabba_bridge_enabled: boolean;
  ai_catalog_engine_enabled: boolean;
  store_portal_enabled: boolean;
  split_pay_enabled: boolean;
  rolling_reserve_enabled: boolean;
  inventory_sync_enabled: boolean;
  auto_reorder_enabled: boolean;
  wholesaler_self_serve_enabled: boolean;
  dispute_auto_submit: boolean;
};

export default function DDSettings() {
  const qc = useQueryClient();

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["dd-config"],
    queryFn: async (): Promise<Cfg | null> => {
      const { data, error } = await supabase
        .from("dd_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Cfg>) => {
      if (!cfg) throw new Error("Config not loaded");
      const { error } = await supabase
        .from("dd_config" as any)
        .update(patch as any)
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-config"] });
      toast.success("Setting saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!cfg) return <div className="p-6 text-sm text-muted-foreground">No config row found.</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Dynasty Direct Settings</h1>
          <p className="text-sm text-muted-foreground">Auto-saves on change.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Business Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Default margin %"
            value={cfg.default_margin_pct ?? 0}
            onSave={(v) => save.mutate({ default_margin_pct: v })}
          />
          <NumberField
            label="Default reserve %"
            value={cfg.default_reserve_pct ?? 0}
            onSave={(v) => save.mutate({ default_reserve_pct: v })}
          />
          <NumberField
            label="Reserve hold days"
            value={cfg.reserve_hold_days ?? 0}
            onSave={(v) => save.mutate({ reserve_hold_days: v })}
          />
          <NumberField
            label="Low stock threshold"
            value={cfg.low_stock_threshold ?? 5}
            onSave={(v) => save.mutate({ low_stock_threshold: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Feature Flags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle label="Grabba Bridge" value={cfg.grabba_bridge_enabled}
            onSave={(v) => save.mutate({ grabba_bridge_enabled: v })} />
          <Toggle label="AI Catalog Engine" value={cfg.ai_catalog_engine_enabled}
            onSave={(v) => save.mutate({ ai_catalog_engine_enabled: v })} />
          <Toggle label="Store Portal" value={cfg.store_portal_enabled}
            onSave={(v) => save.mutate({ store_portal_enabled: v })} />
          <Toggle label="Split Pay" value={cfg.split_pay_enabled}
            onSave={(v) => save.mutate({ split_pay_enabled: v })} />
          <Toggle label="Rolling Reserve" value={cfg.rolling_reserve_enabled}
            onSave={(v) => save.mutate({ rolling_reserve_enabled: v })} />
          <Toggle label="Inventory Sync" value={cfg.inventory_sync_enabled}
            onSave={(v) => save.mutate({ inventory_sync_enabled: v })} />
          <Toggle label="Auto Reorder" value={cfg.auto_reorder_enabled}
            onSave={(v) => save.mutate({ auto_reorder_enabled: v })} />
          <Toggle label="Wholesaler Self-Serve" value={cfg.wholesaler_self_serve_enabled}
            onSave={(v) => save.mutate({ wholesaler_self_serve_enabled: v })} />
          <Toggle label="Dispute Auto-Submit" value={cfg.dispute_auto_submit}
            onSave={(v) => save.mutate({ dispute_auto_submit: v })} />
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label, value, onSave,
}: { label: string; value: number; onSave: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        defaultValue={value}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v !== value) onSave(v);
        }}
      />
    </div>
  );
}

function Toggle({
  label, value, onSave,
}: { label: string; value: boolean; onSave: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <Label>{label}</Label>
      <Switch checked={!!value} onCheckedChange={onSave} />
    </div>
  );
}
