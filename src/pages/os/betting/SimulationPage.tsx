import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, BarChart3 } from "lucide-react";

export default function SimulationPage() {
  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-blue-950/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Center</h1>
          <p className="text-muted-foreground">Track and analyze simulation runs</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500">
          <Play className="h-4 w-4 mr-2" />
          New Simulation
        </Button>
      </div>

      <div className="text-center py-12">
        <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mt-4">No Simulations Yet</h2>
        <p className="text-muted-foreground mt-2">Run simulations to test betting strategies over time.</p>
        <p className="text-xs text-muted-foreground mt-4">
          For informational and entertainment purposes only. Not a sportsbook.
        </p>
      </div>
    </div>
  );
}
