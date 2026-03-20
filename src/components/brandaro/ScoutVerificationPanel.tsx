import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  totalLeads: number | null;
  stageCounts: Record<string, number>;
  scoutLeads: number | null;
  noPhone: number | null;
  paused: number | null;
  nullStage: number | null;
  recentImports: number | null;
  memoryTotal: number;
}

export function ScoutVerificationPanel() {
  const { toast } = useToast();
  const [results, setResults] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const runVerification = async () => {
    setLoading(true);
    try {
      const { count: totalLeads } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true });

      const { data: byStage } = await supabase
        .from("brandaro_qualified_leads")
        .select("pipeline_stage");

      const stageCounts: Record<string, number> = {};
      byStage?.forEach((r: any) => {
        const s = r.pipeline_stage || "null";
        stageCounts[s] = (stageCounts[s] || 0) + 1;
      });

      const { count: scoutLeads } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true })
        .not("discovery_job_id", "is", null);

      const { count: noPhone } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true })
        .is("phone_number", null);

      const { count: paused } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true })
        .eq("ai_paused", true);

      const { count: nullStage } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true })
        .is("pipeline_stage", null);

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentImports } = await supabase
        .from("brandaro_qualified_leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday);

      const { data: memoryStats } = await supabase
        .from("brandaro_scout_memory" as any)
        .select("leads_imported")
        .order("searched_at", { ascending: false });

      const memoryTotal = memoryStats?.reduce((s: number, m: any) => s + (m.leads_imported || 0), 0) || 0;

      setResults({ totalLeads, stageCounts, scoutLeads, noPhone, paused, nullStage, recentImports, memoryTotal });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runAutoFix = async () => {
    setFixing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brandaro-fix-imports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fix error ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      toast({
        title: `✅ Fixed ${data.total_fixed || 0} leads`,
        description: Object.entries(data.fixes || {}).map(([k, v]) => `${k}: ${v}`).join(", "),
      });
      // Re-run verification
      await runVerification();
    } catch (err: any) {
      toast({ title: "Fix failed", description: err.message, variant: "destructive" });
    } finally {
      setFixing(false);
    }
  };

  const stageOrder = ["new", "contacted", "responded", "interested", "booked", "closed", "lost"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Import Verification
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={runVerification} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Verify
            </Button>
            {results && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={runAutoFix} disabled={fixing}>
                {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                Auto-Fix
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {results && (
        <CardContent className="space-y-4">
          <div className="text-[10px] text-muted-foreground">Generated: {new Date().toLocaleString()}</div>

          {/* Database Status */}
          <div>
            <p className="text-xs font-semibold mb-2">DATABASE STATUS</p>
            <div className="space-y-1">
              <StatusRow ok label="Total leads in database" value={results.totalLeads} />
              <StatusRow ok label="Scout-discovered leads" value={results.scoutLeads} />
              <StatusRow ok label="Leads imported last 24h" value={results.recentImports} />
              <StatusRow warn={!!results.noPhone && results.noPhone > 0} label="Leads with no phone (cannot contact)" value={results.noPhone} />
              <StatusRow warn={!!results.paused && results.paused > 0} label="Leads with ai_paused (blocked)" value={results.paused} />
              <StatusRow warn={!!results.nullStage && results.nullStage > 0} label="Leads with null stage (not in pipeline)" value={results.nullStage} />
            </div>
          </div>

          {/* Pipeline Distribution */}
          <div>
            <p className="text-xs font-semibold mb-2">PIPELINE DISTRIBUTION</p>
            <div className="grid grid-cols-4 gap-1">
              {stageOrder.map((s) => (
                <div key={s} className="text-center p-1.5 rounded bg-muted/50">
                  <p className="text-xs capitalize font-medium">{s}</p>
                  <p className="text-sm font-bold">{results.stageCounts[s] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Memory vs Database */}
          <div>
            <p className="text-xs font-semibold mb-2">SCOUT MEMORY vs DATABASE</p>
            <div className="space-y-1 text-xs">
              <p>Memory says imported: <span className="font-medium">{results.memoryTotal}</span></p>
              <p>Scout leads in database: <span className="font-medium">{results.scoutLeads}</span></p>
              {results.memoryTotal !== (results.scoutLeads || 0) && (
                <p className="text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Difference: {Math.abs(results.memoryTotal - (results.scoutLeads || 0))} (possible sync gap)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StatusRow({ ok, warn, label, value }: { ok?: boolean; warn?: boolean; label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {warn ? (
        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
      ) : (
        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
      )}
      <span className={warn ? "text-amber-600" : ""}>{label}: <span className="font-medium">{value ?? 0}</span></span>
    </div>
  );
}
