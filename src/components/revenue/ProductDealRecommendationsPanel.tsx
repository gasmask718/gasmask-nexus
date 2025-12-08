import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Percent, Package, Gift, Sparkles, RefreshCw } from "lucide-react";
import { useProductDealRecommendations, useRevenueEngineV2Actions } from "@/hooks/useRevenueEngineV2";

interface ProductDealRecommendationsPanelProps {
  businessId?: string;
  verticalId?: string;
  onSelectDeal?: (deal: any) => void;
}

export function ProductDealRecommendationsPanel({ 
  businessId, 
  verticalId,
  onSelectDeal 
}: ProductDealRecommendationsPanelProps) {
  const { data: deals, isLoading } = useProductDealRecommendations(businessId, verticalId);
  const { generateDealRecommendations, isLoading: actionsLoading } = useRevenueEngineV2Actions();

  const getDealIcon = (type: string | null) => {
    switch (type) {
      case 'discount': return <Percent className="h-4 w-4 text-green-500" />;
      case 'bundle': return <Package className="h-4 w-4 text-blue-500" />;
      case 'intro': return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'bogo': return <Gift className="h-4 w-4 text-orange-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getDealBadge = (type: string | null) => {
    switch (type) {
      case 'discount': return <Badge className="bg-green-500">Discount</Badge>;
      case 'bundle': return <Badge className="bg-blue-500">Bundle</Badge>;
      case 'intro': return <Badge className="bg-purple-500">Intro Offer</Badge>;
      case 'bogo': return <Badge className="bg-orange-500">BOGO</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getSegmentBadge = (segment: string | null) => {
    switch (segment) {
      case 'high_value': return <Badge variant="secondary">High Value</Badge>;
      case 'all_stores': return <Badge variant="outline">All Stores</Badge>;
      case 'new_stores': return <Badge variant="outline">New Stores</Badge>;
      case 'churn_risk': return <Badge variant="destructive">Churn Risk</Badge>;
      default: return null;
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
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Deal Recommendations
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => generateDealRecommendations.mutate({ businessId, verticalId })}
          disabled={actionsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${generateDealRecommendations.isPending ? 'animate-spin' : ''}`} />
          Generate
        </Button>
      </CardHeader>
      <CardContent>
        {deals && deals.length > 0 ? (
          <div className="space-y-3">
            {deals.slice(0, 5).map((deal) => (
              <div 
                key={deal.id}
                className="p-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onSelectDeal?.(deal)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getDealIcon(deal.deal_type)}
                    {getDealBadge(deal.deal_type)}
                    {getSegmentBadge(deal.target_segment)}
                  </div>
                  {deal.suggested_discount_pct && (
                    <span className="text-lg font-bold text-green-500">
                      -{deal.suggested_discount_pct}%
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {deal.notes}
                </p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {deal.product_id && (
                    <span>Product: #{deal.product_id.slice(0, 8)}</span>
                  )}
                  {deal.suggested_min_qty && (
                    <span>Min qty: {deal.suggested_min_qty}</span>
                  )}
                </div>

                {onSelectDeal && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDeal(deal);
                    }}
                  >
                    Use in Campaign
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">No deal recommendations yet</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => generateDealRecommendations.mutate({ businessId, verticalId })}
              disabled={actionsLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Deals
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
