import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Brain, MapPin, TrendingUp, AlertTriangle, Zap, RefreshCw, Loader2, BarChart3 } from "lucide-react";
import { useTerritoryHeatmap, useCategoryDemand, useCityDemand, useRunAIScoring } from "@/hooks/useUTTerritoryIntelligence";
import { toast } from "sonner";

const GAP_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const DEMAND_COLORS: Record<string, string> = {
  high: "bg-purple-500/10 text-purple-400",
  medium: "bg-blue-500/10 text-blue-400",
  low: "bg-muted text-muted-foreground",
};

export default function UTTerritoryIntelligence() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"heatmap" | "categories" | "cities">("heatmap");
  const { data: heatmap = [], isLoading: hLoading } = useTerritoryHeatmap();
  const { data: categories = [], isLoading: cLoading } = useCategoryDemand();
  const { data: cities = [], isLoading: ciLoading } = useCityDemand();
  const scoring = useRunAIScoring();

  const handleRunScoring = async () => {
    try {
      const count = await scoring.mutateAsync();
      toast.success(`AI scored ${count} leads`);
    } catch {
      toast.error("Scoring failed");
    }
  };

  const criticalGaps = heatmap.filter(h => h.supply_gap === "critical").length;
  const highDemand = heatmap.filter(h => h.demand_level === "high").length;
  const totalOnboarded = heatmap.reduce((s, h) => s + (h.onboarded || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/os/unforgettable/outreach")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Territory Intelligence</h1>
            <p className="text-sm text-muted-foreground">Supply-demand analysis & AI scoring engine</p>
          </div>
        </div>
        <Button onClick={handleRunScoring} disabled={scoring.isPending} className="gap-2">
          {scoring.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          Run AI Scoring
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{criticalGaps}</div>
            <div className="text-xs text-muted-foreground">Critical Gaps</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-purple-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{highDemand}</div>
            <div className="text-xs text-muted-foreground">High Demand Zones</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{totalOnboarded}</div>
            <div className="text-xs text-muted-foreground">Onboarded Partners</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{heatmap.length}</div>
            <div className="text-xs text-muted-foreground">Territory Cells</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        {(["heatmap", "categories", "cities"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md transition-colors ${
              tab === t ? "bg-primary/10 text-primary font-medium border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "heatmap" ? "Territory Heatmap" : t === "categories" ? "Category Demand" : "City Demand"}
          </button>
        ))}
      </div>

      {/* Heatmap Tab */}
      {tab === "heatmap" && (
        <Card>
          <CardContent className="p-0">
            {hLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : heatmap.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No territory data yet. Import leads to populate.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Onboarded</TableHead>
                    <TableHead className="text-center">Supply Gap</TableHead>
                    <TableHead className="text-center">Demand</TableHead>
                    <TableHead className="text-center">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heatmap.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.city || "—"}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell className="text-center">{row.total_leads}</TableCell>
                      <TableCell className="text-center">{row.onboarded}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={GAP_COLORS[row.supply_gap] || ""}>
                          {row.supply_gap}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={DEMAND_COLORS[row.demand_level] || ""}>{row.demand_level}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{row.conversion_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categories Tab */}
      {tab === "categories" && (
        <Card>
          <CardContent className="p-0">
            {cLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Total Leads</TableHead>
                    <TableHead className="text-center">Supply</TableHead>
                    <TableHead className="text-center">Pipeline</TableHead>
                    <TableHead className="text-center">Gap Level</TableHead>
                    <TableHead className="text-center">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium capitalize">{cat.category?.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-center">{cat.total_leads}</TableCell>
                      <TableCell className="text-center">{cat.supply_count}</TableCell>
                      <TableCell className="text-center">{cat.demand_pipeline}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={GAP_COLORS[cat.supply_gap_level] || ""}>{cat.supply_gap_level}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{cat.conversion_rate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cities Tab */}
      {tab === "cities" && (
        <Card>
          <CardContent className="p-0">
            {ciLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-center">Categories</TableHead>
                    <TableHead className="text-center">Supply</TableHead>
                    <TableHead className="text-center">Pipeline</TableHead>
                    <TableHead className="text-center">Gap Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cities.map((city, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{city.city || "—"}</TableCell>
                      <TableCell className="text-center">{city.total_leads}</TableCell>
                      <TableCell className="text-center">{city.category_count}</TableCell>
                      <TableCell className="text-center">{city.supply_count}</TableCell>
                      <TableCell className="text-center">{city.demand_pipeline}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={GAP_COLORS[city.supply_gap_level] || ""}>{city.supply_gap_level}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
