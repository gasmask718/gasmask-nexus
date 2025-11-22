import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OfferAnalyzer() {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const { toast } = useToast();

  const analyzeDeal = async () => {
    if (!leadId) {
      toast({
        title: "Lead ID Required",
        description: "Please enter a lead ID to analyze",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: lead, error: leadError } = await supabase
        .from("leads_raw")
        .select("*, ai_comps(*)")
        .eq("id", leadId)
        .single();

      if (leadError) throw leadError;

      const comps = lead.ai_comps?.[0];

      // Calculate analysis metrics
      const offerPrice = comps?.offer_price || lead.estimated_value;
      const arv = comps?.arv || offerPrice * 1.3;
      const repairCost = comps?.repair_cost || arv * 0.15;
      const assignmentFee = comps?.assignment_fee || 10000;
      const buyerProfit = arv - offerPrice - repairCost - assignmentFee - (arv * 0.1);
      const wholesaleSpread = assignmentFee;
      const roi = ((buyerProfit / (offerPrice + repairCost)) * 100).toFixed(1);
      
      // Risk scoring
      let riskScore = 0;
      let riskFactors: string[] = [];
      
      if (buyerProfit < 20000) {
        riskScore += 30;
        riskFactors.push("Low buyer profit margin");
      }
      if (repairCost > arv * 0.25) {
        riskScore += 25;
        riskFactors.push("High repair costs");
      }
      if (assignmentFee > 20000) {
        riskScore += 20;
        riskFactors.push("High assignment fee may limit buyer pool");
      }
      if (Number(roi) < 15) {
        riskScore += 25;
        riskFactors.push("Low ROI for end buyer");
      }

      setAnalysis({
        lead,
        comps,
        metrics: {
          offerPrice,
          arv,
          repairCost,
          assignmentFee,
          buyerProfit,
          wholesaleSpread,
          roi,
          riskScore,
          riskFactors
        }
      });

      toast({
        title: "Analysis Complete",
        description: "Deal metrics have been calculated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score < 30) return <Badge className="bg-green-500">Low Risk</Badge>;
    if (score < 60) return <Badge className="bg-yellow-500">Medium Risk</Badge>;
    return <Badge className="bg-red-500">High Risk</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Offer Analyzer</h1>
          <p className="text-muted-foreground">
            Comprehensive deal analysis and risk assessment
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analyze Deal</CardTitle>
            <CardDescription>Enter a lead ID to get detailed analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter Lead ID"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            />
            <Button onClick={analyzeDeal} disabled={loading}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Analyze Deal
            </Button>
          </CardContent>
        </Card>

        {analysis && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{analysis.lead.address}</p>
                  <p className="text-sm">{analysis.lead.city}, {analysis.lead.state} {analysis.lead.zip_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Property Type</p>
                  <p className="font-medium">{analysis.lead.property_type}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Risk Score:</span>
                  {getRiskBadge(analysis.metrics.riskScore)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Risk Factors:</p>
                  {analysis.metrics.riskFactors.length > 0 ? (
                    <ul className="space-y-1">
                      {analysis.metrics.riskFactors.map((factor: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      No significant risk factors identified
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Offer Price:</span>
                  <span className="font-medium">${analysis.metrics.offerPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">ARV:</span>
                  <span className="font-medium">${analysis.metrics.arv.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Repair Cost:</span>
                  <span className="font-medium">${analysis.metrics.repairCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Assignment Fee:</span>
                  <span className="font-medium text-green-600">${analysis.metrics.assignmentFee.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-medium">Buyer Profit:</span>
                  <span className="font-bold">${analysis.metrics.buyerProfit.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  ROI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wholesale Spread:</span>
                  <span className="font-medium">${analysis.metrics.wholesaleSpread.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Buyer ROI:</span>
                  <span className="font-bold text-green-600">{analysis.metrics.roi}%</span>
                </div>
                <div className="pt-3 border-t">
                  {Number(analysis.metrics.roi) >= 20 ? (
                    <Badge className="bg-green-500 w-full justify-center">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Excellent Deal
                    </Badge>
                  ) : Number(analysis.metrics.roi) >= 15 ? (
                    <Badge className="bg-yellow-500 w-full justify-center">
                      Good Deal
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="w-full justify-center">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Review Required
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}