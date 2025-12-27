import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Plus, TrendingUp, AlertTriangle } from "lucide-react";

export default function ParlayLab() {
  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-purple-950/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parlay Lab</h1>
          <p className="text-muted-foreground">Build and simulate parlay combinations</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-600 to-blue-500">
          <Plus className="h-4 w-4 mr-2" />
          New Parlay
        </Button>
      </div>

      <div className="text-center py-12">
        <Layers className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mt-4">Parlay Simulator</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Combine simulated bets into parlays. Supports sportsbook and pick'em platforms.
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          For informational and entertainment purposes only. Not a sportsbook.
        </p>
      </div>
    </div>
  );
}
