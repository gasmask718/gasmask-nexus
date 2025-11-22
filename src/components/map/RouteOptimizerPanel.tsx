import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, Route as RouteIcon, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RouteOptimizerPanelProps {
  onRoutesGenerated: () => void;
}

export function RouteOptimizerPanel({ onRoutesGenerated }: RouteOptimizerPanelProps) {
  const [loading, setLoading] = useState(false);
  const [territory, setTerritory] = useState<string>("");
  const [date, setDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-routes', {
        body: { date, territory: territory || null }
      });

      if (error) throw error;

      toast.success(`✨ ${data.routes_created} optimized routes created!`, {
        description: `Total stops: ${data.routes.reduce((sum: number, r: any) => sum + r.stops, 0)}`
      });

      onRoutesGenerated();
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast.error('Failed to optimize routes', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-lg">AI Route Optimizer</h3>
        <Badge variant="secondary" className="ml-auto">
          Smart Clustering
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Generate optimized routes for tomorrow based on inventory urgency, location, and driver availability.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-background border rounded-md"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Territory (Optional)</label>
          <Select value={territory} onValueChange={setTerritory}>
            <SelectTrigger>
              <SelectValue placeholder="All territories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All territories</SelectItem>
              <SelectItem value="Brooklyn">Brooklyn</SelectItem>
              <SelectItem value="Queens">Queens</SelectItem>
              <SelectItem value="Manhattan">Manhattan</SelectItem>
              <SelectItem value="Bronx">Bronx</SelectItem>
              <SelectItem value="Staten Island">Staten Island</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleOptimize}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Optimizing Routes...
            </>
          ) : (
            <>
              <RouteIcon className="h-4 w-4 mr-2" />
              Generate Optimized Routes
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span>Clusters stores by urgency + proximity</span>
        </div>
        <div className="flex items-center gap-2">
          <RouteIcon className="h-3 w-3 text-primary" />
          <span>6-15 stops per route for efficiency</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-primary" />
          <span>Auto-assigns to available drivers</span>
        </div>
      </div>
    </Card>
  );
}