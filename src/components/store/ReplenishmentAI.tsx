import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReplenishmentAIProps {
  storeId: string;
}

export function ReplenishmentAI({ storeId }: ReplenishmentAIProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: recommendations, isLoading, refetch } = useQuery({
    queryKey: ["replenishment-ai", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("replenishment-ai", {
        body: { storeId },
      });

      if (error) throw error;
      return data;
    },
    enabled: false, // Only run on demand
  });

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await refetch();
      toast({
        title: "Analysis complete",
        description: `Generated ${recommendations?.recommendations?.length || 0} recommendations`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return "text-red-500 border-red-500";
    if (score >= 50) return "text-yellow-500 border-yellow-500";
    return "text-green-500 border-green-500";
  };

  const getTimingColor = (timing: string) => {
    switch (timing) {
      case "urgent": return "destructive";
      case "soon": return "default";
      default: return "secondary";
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Replenishment Suggestions</h3>
        </div>
        <Button 
          onClick={runAnalysis} 
          disabled={isAnalyzing}
          size="sm"
        >
          {isAnalyzing ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Analyzing replenishment needs...
        </div>
      )}

      {recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.recommendations.map((rec: any, index: number) => (
            <div
              key={index}
              className="p-4 border rounded-lg space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">{rec.product_name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {rec.wholesaler_name}
                  </p>
                  <p className="text-sm">{rec.reason}</p>
                </div>
                <div className="text-right">
                  <Badge className={getRiskColor(rec.stockout_risk_score)}>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {rec.stockout_risk_score}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Qty:</span>
                    <span className="font-semibold ml-1">
                      {rec.recommended_quantity} x {rec.case_size}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold ml-1">
                      ${rec.product_price}
                    </span>
                  </div>
                  <Badge variant={getTimingColor(rec.recommended_timing)}>
                    {rec.recommended_timing}
                  </Badge>
                </div>
                <Button size="sm">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : recommendations && !isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No urgent replenishment needs detected</p>
          <p className="text-sm">Inventory levels look good!</p>
        </div>
      ) : !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Click "Run Analysis" to get AI-powered recommendations</p>
          <p className="text-sm mt-1">Based on order history and inventory levels</p>
        </div>
      )}

      {recommendations?.analysis && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            Analysis based on {recommendations.analysis.total_past_orders} past orders 
            {recommendations.analysis.days_since_last_order && 
              ` • Last order ${recommendations.analysis.days_since_last_order} days ago`}
          </p>
        </div>
      )}
    </Card>
  );
}