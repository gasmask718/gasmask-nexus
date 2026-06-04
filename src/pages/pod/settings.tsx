import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Channel registry — the secret name is the EXACT credential needed to flip live.
const CHANNELS: Array<{
  channel: "printify" | "etsy" | "ebay" | "amazon" | "shopify";
  name: string;
  secret: string;
  phase: "phase1" | "phase2";
  note: string;
}> = [
  { channel: "printify", name: "Printify", secret: "PRINTIFY_API_KEY", phase: "phase1",
    note: "Primary fulfillment. Goes live the moment the API key lands." },
  { channel: "etsy", name: "Etsy", secret: "ETSY_API_KEY", phase: "phase2",
    note: "Requires OAuth app + shop_id." },
  { channel: "ebay", name: "eBay", secret: "EBAY_API_TOKEN", phase: "phase2",
    note: "eBay Inventory API token." },
  { channel: "amazon", name: "Amazon", secret: "AMAZON_SP_API_TOKEN", phase: "phase2",
    note: "Selling Partner API LWA refresh token." },
  { channel: "shopify", name: "Shopify", secret: "SHOPIFY_ADMIN_API_TOKEN", phase: "phase2",
    note: "Admin API access token (custom app)." },
];

export default function PODSettings() {
  const [counts, setCounts] = useState<Record<string, { total: number; pending: number; draft: number; live: number }>>({});
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: listings } = await supabase
        .from("pod_listings" as any)
        .select("channel, status");
      const acc: Record<string, any> = {};
      (listings || []).forEach((l: any) => {
        acc[l.channel] ||= { total: 0, pending: 0, draft: 0, live: 0 };
        acc[l.channel].total++;
        if (l.status === "pending_keys") acc[l.channel].pending++;
        else if (l.status === "draft") acc[l.channel].draft++;
        else if (l.status === "live" || l.status === "listed") acc[l.channel].live++;
      });
      setCounts(acc);

      const { data: ma } = await supabase
        .from("pod_marketplace_accounts")
        .select("platform_name, connection_status");
      setAccounts(ma || []);
    })();
  }, []);

  const isConnected = (ch: string) => {
    // Honest state: connection_status='connected' AND row exists in pod_marketplace_accounts.
    // (Secret presence is server-side only; the listing fan-out marks rows correctly.)
    return accounts.some((a) => a.platform_name === ch && a.connection_status === "connected");
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">POD Channel Registry</h1>
        <p className="text-muted-foreground">
          One card per channel. Each names the exact credential needed.
          Listings auto-flip from <code>pending_keys</code> → <code>draft</code> once the secret is in Lovable Cloud.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNELS.map((c) => {
          const connected = isConnected(c.channel);
          const k = counts[c.channel] || { total: 0, pending: 0, draft: 0, live: 0 };
          return (
            <Card key={c.channel} className={connected ? "border-green-500/40" : "border-amber-500/30"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {connected ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                               : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                    {c.name}
                  </span>
                  <Badge variant={connected ? "default" : "outline"}>
                    {connected ? "Connected" : "Pending keys"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Key className="h-4 w-4" />
                  <code className="text-xs">{c.secret}</code>
                </div>
                <p className="text-xs text-muted-foreground">{c.note}</p>
                <div className="grid grid-cols-4 gap-1 pt-2 border-t text-center">
                  <Stat label="Total" value={k.total} />
                  <Stat label="Pending" value={k.pending} amber />
                  <Stat label="Draft" value={k.draft} />
                  <Stat label="Live" value={k.live} green />
                </div>
                {c.phase === "phase1" && !connected && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Zap className="h-3 w-3" /> Phase 1 — primed for first live channel
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, green, amber }: { label: string; value: number; green?: boolean; amber?: boolean }) {
  const color = green ? "text-green-500" : amber ? "text-amber-500" : "text-foreground";
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}
