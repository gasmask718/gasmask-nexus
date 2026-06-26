import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const EVENT_TYPES = [
  { key: "new_booking", label: "New booking received" },
  { key: "payment_failed", label: "Payment failed" },
  { key: "customer_flagged", label: "Customer flagged by partner" },
  { key: "sla_breach", label: "Pending SLA breach (>60 min)" },
  { key: "high_value_booking", label: "High-value booking (>$2,000)" },
  { key: "dispatch_failure", label: "Dispatch failure (no eligible partners)" },
];

type Pref = {
  event_type: string;
  channel: "sms" | "email" | "both";
  is_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export default function AdminNotificationSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("admin_notification_preferences")
        .select("event_type, channel, is_enabled, quiet_hours_start, quiet_hours_end")
        .eq("admin_user_id", user.id);
      const map: Record<string, Pref> = {};
      (data ?? []).forEach((p: any) => { map[p.event_type] = p; });
      // Default rows for any missing event types
      for (const e of EVENT_TYPES) {
        if (!map[e.key]) {
          map[e.key] = { event_type: e.key, channel: "both", is_enabled: true, quiet_hours_start: null, quiet_hours_end: null };
        }
      }
      setPrefs(map);
      setLoading(false);
    })();
  }, []);

  const update = (key: string, patch: Partial<Pref>) => {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  };

  const save = async () => {
    if (!userId) return;
    const rows = Object.values(prefs).map((p) => ({
      admin_user_id: userId,
      event_type: p.event_type,
      channel: p.channel,
      is_enabled: p.is_enabled,
      quiet_hours_start: p.quiet_hours_start || null,
      quiet_hours_end: p.quiet_hours_end || null,
    }));
    const { error } = await supabase
      .from("admin_notification_preferences")
      .upsert(rows, { onConflict: "admin_user_id,event_type" });
    if (error) toast.error(error.message); else toast.success("Preferences saved");
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Admin Notification Settings</h1>
        <p className="text-sm text-muted-foreground">Control how you receive real-time platform alerts.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Event preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {EVENT_TYPES.map((e) => {
            const p = prefs[e.key];
            return (
              <div key={e.key} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b pb-3">
                <div className="md:col-span-4">
                  <div className="font-medium">{e.label}</div>
                  <div className="text-xs text-muted-foreground">{e.key}</div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Switch checked={p.is_enabled} onCheckedChange={(v) => update(e.key, { is_enabled: v })} />
                  <span className="text-xs">{p.is_enabled ? "On" : "Off"}</span>
                </div>
                <div className="md:col-span-2">
                  <Select value={p.channel} onValueChange={(v: any) => update(e.key, { channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Input type="time" value={p.quiet_hours_start ?? ""} onChange={(ev) => update(e.key, { quiet_hours_start: ev.target.value || null })} placeholder="Quiet start" />
                </div>
                <div className="md:col-span-2">
                  <Input type="time" value={p.quiet_hours_end ?? ""} onChange={(ev) => update(e.key, { quiet_hours_end: ev.target.value || null })} placeholder="Quiet end" />
                </div>
              </div>
            );
          })}
          <div className="flex justify-end pt-2">
            <Button onClick={save}>Save preferences</Button>
          </div>
          <p className="text-xs text-muted-foreground">During quiet hours, SMS is suppressed and email is still delivered.</p>
        </CardContent>
      </Card>
    </div>
  );
}
