import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PODScaling() {
  const [winners, setWinners] = useState<any[]>([]);

  useEffect(() => {
    fetchWinners();
  }, []);

  const fetchWinners = async () => {
    try {
      const { data } = await supabase
        .from("pod_designs")
        .select("*")
        .in("status", ["performing", "winning"])
        .order("variations_created", { ascending: false });
      setWinners(data || []);
    } catch (error) {
      console.error("Error fetching winners:", error);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Winner Scaling Engine</h1>
        <p className="text-muted-foreground">
          Auto-detect and scale high-performing designs
        </p>
      </div>

      {/* Scaling Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Winners</CardTitle>
            <Target className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {winners.filter((w) => w.status === "winning").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Performing</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {winners.filter((w) => w.status === "performing").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Variations</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {winners.reduce((sum, w) => sum + (w.variations_created || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Scaling Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Scaling Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Scaling Engine Status</span>
            <Badge variant="default">ACTIVE</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The AI will automatically detect high-performing designs based on sales velocity
            and CTR, then create 20-50 variations and scale uploads across platforms.
          </p>
          <div className="pt-2 border-t space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-variation threshold:</span>
              <span className="font-medium">5 sales/day</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max variations per winner:</span>
              <span className="font-medium">50</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target platforms:</span>
              <span className="font-medium">All connected</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Winners List */}
      {winners.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Scaling Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {winners.map((winner) => (
              <Card key={winner.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{winner.title}</CardTitle>
                    <Badge
                      className={
                        winner.status === "winning" ? "bg-red-500" : "bg-yellow-500"
                      }
                    >
                      {winner.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variations Created:</span>
                    <span className="font-medium">{winner.variations_created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{winner.category}</Badge>
                  </div>
                  {winner.platforms_uploaded && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Platforms:</p>
                      <div className="flex flex-wrap gap-1">
                        {winner.platforms_uploaded.map((p: string) => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No winners detected yet. Upload designs and start generating sales!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
