import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, Calendar, RefreshCw, Send } from "lucide-react";
import { useStoreProductPredictions, useRevenueEngineV2Actions } from "@/hooks/useRevenueEngineV2";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StoreProductPredictionsPanelProps {
  storeId: string;
}

export function StoreProductPredictionsPanel({ storeId }: StoreProductPredictionsPanelProps) {
  const { data: predictions, isLoading } = useStoreProductPredictions(storeId);
  const { computeStorePredictions, isLoading: actionsLoading } = useRevenueEngineV2Actions();
  const { toast } = useToast();

  const handleCreateFollowUp = async (prediction: any) => {
    try {
      await supabase.from('follow_up_queue').insert({
        store_id: storeId,
        business_id: prediction.business_id,
        vertical_id: prediction.vertical_id,
        reason: `product_${(prediction.tags || []).includes('restock') ? 'restock' : 'upsell'}`,
        recommended_action: 'ai_text',
        priority: prediction.buy_prob_7d >= 70 ? 1 : 2,
        context: {
          source: 'revenue_engine_v2',
          product_id: prediction.product_id,
          buy_prob_7d: prediction.buy_prob_7d,
          expected_quantity: prediction.expected_quantity
        },
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      });

      toast({ title: "Follow-up created", description: "Product follow-up added to queue" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create follow-up", variant: "destructive" });
    }
  };

  const getTagBadge = (tag: string) => {
    switch (tag) {
      case 'restock': return <Badge className="bg-blue-500">Restock</Badge>;
      case 'upsell': return <Badge className="bg-green-500">Upsell</Badge>;
      case 'primary': return <Badge variant="secondary">Primary</Badge>;
      case 'new_product': return <Badge className="bg-purple-500">New</Badge>;
      default: return <Badge variant="outline">{tag}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Top Predicted Products
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => computeStorePredictions.mutate({ storeId })}
          disabled={actionsLoading}
        >
          <RefreshCw className={`h-4 w-4 ${computeStorePredictions.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {predictions && predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.slice(0, 5).map((pred) => (
              <div 
                key={pred.id} 
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      Product #{pred.product_id.slice(0, 8)}
                    </span>
                    {pred.is_primary_sku && (
                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>{Math.round(pred.buy_prob_7d || 0)}% 7d prob</span>
                    </div>
                    {pred.last_order_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Last: {format(new Date(pred.last_order_at), 'MMM d')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {(pred.tags || []).map((tag, idx) => (
                      <span key={idx}>{getTagBadge(tag)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="w-20">
                    <Progress value={pred.buy_prob_7d || 0} className="h-2" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCreateFollowUp(pred)}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Follow-Up
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">No product predictions yet</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => computeStorePredictions.mutate({ storeId })}
              disabled={actionsLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Predictions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
