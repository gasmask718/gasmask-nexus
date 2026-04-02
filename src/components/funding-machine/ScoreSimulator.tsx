import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, Loader2, ArrowRight, TrendingUp } from "lucide-react";

interface Props {
  clientId: string;
}

interface SimResult {
  projected_change_tu: number;
  projected_change_eq: number;
  projected_change_ex: number;
  confidence: string;
  reasoning: string;
}

export default function ScoreSimulator({ clientId }: Props) {
  const [open, setOpen] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);

  // Scenario states
  const [selectedItemId, setSelectedItemId] = useState("");
  const [targetUtil, setTargetUtil] = useState([15]);
  const [tradelineAge, setTradelineAge] = useState("");
  const [tradelineLimit, setTradelineLimit] = useState("");
  const [auAge, setAuAge] = useState("");
  const [auLimit, setAuLimit] = useState("");

  const { data: dfs } = useQuery({
    queryKey: ["sim-dfs", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("funding_dfs_scores")
        .select("personal_credit_tu, personal_credit_eq, personal_credit_ex")
        .eq("client_id", clientId).order("scored_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["sim-items", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("funding_credit_items").select("id, creditor_name, item_type, estimated_score_impact").eq("client_id", clientId);
      return data || [];
    },
  });

  const scores = {
    tu: dfs?.personal_credit_tu ?? 0,
    eq: dfs?.personal_credit_eq ?? 0,
    ex: dfs?.personal_credit_ex ?? 0,
  };

  const runSim = async (scenarioType: string, params: Record<string, any>) => {
    setSimulating(scenarioType);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("funding-ai-agent", {
        body: {
          action: "simulate_score_impact",
          current_scores: scores,
          scenario_type: scenarioType,
          scenario_parameters: params,
        },
      });
      if (error) throw error;
      if (data?.simulation) {
        setResult(data.simulation);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSimulating(null);
    }
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  const ScoreGauge = ({ label, score, change }: { label: string; score: number; change?: number }) => {
    const projected = change ? score + change : score;
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="w-24 text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <div className="w-[60px] h-[60px] rounded-full border-2 border-muted flex items-center justify-center">
            <span className="text-sm font-bold">{score || "—"}</span>
          </div>
          {change !== undefined && (
            <>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`w-[60px] h-[60px] rounded-full border-2 flex items-center justify-center ${change > 0 ? "border-emerald-500 bg-emerald-500/10" : change < 0 ? "border-red-500 bg-red-500/10" : "border-muted"}`}>
                <span className="text-sm font-bold">{projected}</span>
              </div>
              <Badge className={`text-xs ${change > 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : change < 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-muted text-muted-foreground"}`}>
                {change > 0 ? "+" : ""}{change}
              </Badge>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-amber-500/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/10 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" /> Model Score Scenarios
              </span>
              <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Baseline scores */}
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-sm font-medium text-muted-foreground mb-2">Current Bureau Scores</p>
              <div className="flex gap-6">
                <span className="text-sm">TU: <strong className="text-blue-400">{scores.tu || "—"}</strong></span>
                <span className="text-sm">EQ: <strong className="text-red-400">{scores.eq || "—"}</strong></span>
                <span className="text-sm">EX: <strong className="text-emerald-400">{scores.ex || "—"}</strong></span>
              </div>
            </div>

            {/* 4 scenario cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Remove Negative Item */}
              <Card className="border-border/30">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-red-400">Remove Negative Item</h4>
                  <div>
                    <Label className="text-xs">Select Item</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                      <option value="">Choose...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.creditor_name} — {i.item_type}</option>)}
                    </select>
                    {selectedItem?.estimated_score_impact && (
                      <p className="text-xs text-muted-foreground mt-1">Estimated Impact: {selectedItem.estimated_score_impact}/10</p>
                    )}
                  </div>
                  <Button size="sm" disabled={!selectedItemId || simulating === "remove_item"}
                    onClick={() => runSim("remove_item", { item: selectedItem })}
                    className="w-full bg-gradient-to-r from-red-600 to-rose-500 text-white text-xs">
                    {simulating === "remove_item" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              {/* Reduce Utilization */}
              <Card className="border-border/30">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400">Reduce Utilization</h4>
                  <div>
                    <Label className="text-xs">Target Utilization: {targetUtil[0]}%</Label>
                    <Slider value={targetUtil} onValueChange={setTargetUtil} min={1} max={90} step={1} className="mt-2" />
                  </div>
                  <Button size="sm" disabled={simulating === "reduce_utilization"}
                    onClick={() => runSim("reduce_utilization", { target_utilization: targetUtil[0] })}
                    className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 text-black text-xs">
                    {simulating === "reduce_utilization" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              {/* Add Positive Tradeline */}
              <Card className="border-border/30">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-emerald-400">Add Positive Tradeline</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Account Age (years)</Label>
                      <Input type="number" value={tradelineAge} onChange={e => setTradelineAge(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Credit Limit ($)</Label>
                      <Input type="number" value={tradelineLimit} onChange={e => setTradelineLimit(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <Button size="sm" disabled={!tradelineAge || !tradelineLimit || simulating === "add_tradeline"}
                    onClick={() => runSim("add_tradeline", { age_years: Number(tradelineAge), credit_limit: Number(tradelineLimit) })}
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-500 text-white text-xs">
                    {simulating === "add_tradeline" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              {/* Add Authorized User */}
              <Card className="border-border/30">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-blue-400">Add Authorized User</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Card Age (years)</Label>
                      <Input type="number" value={auAge} onChange={e => setAuAge(e.target.value)} className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Card Limit ($)</Label>
                      <Input type="number" value={auLimit} onChange={e => setAuLimit(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <Button size="sm" disabled={!auAge || !auLimit || simulating === "add_authorized_user"}
                    onClick={() => runSim("add_authorized_user", { card_age_years: Number(auAge), card_limit: Number(auLimit) })}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-500 text-white text-xs">
                    {simulating === "add_authorized_user" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Results */}
            {result && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400">Projected Score Impact</h4>
                  <ScoreGauge label="TransUnion" score={scores.tu} change={result.projected_change_tu} />
                  <ScoreGauge label="Equifax" score={scores.eq} change={result.projected_change_eq} />
                  <ScoreGauge label="Experian" score={scores.ex} change={result.projected_change_ex} />
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`text-xs ${result.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" : result.confidence === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`}>
                      {result.confidence} confidence
                    </Badge>
                  </div>
                  <p className="text-sm italic text-muted-foreground">{result.reasoning}</p>
                  <p className="text-xs text-muted-foreground border-t border-border/30 pt-2 mt-2">
                    Score projections are estimates based on general scoring models and are for planning purposes only. Actual results may vary.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
