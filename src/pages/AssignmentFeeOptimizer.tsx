import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AssignmentFeeOptimizer() {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const { toast } = useToast();

  const optimizeFee = async () => {
    if (!leadId) {
      toast({
        title: "Lead ID Required",
        description: "Please enter a lead ID to optimize",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-assignment-fee-ai', {
        body: { lead_id: leadId }
      });

      if (error) throw error;

      setOptimization(data.optimization);
      toast({
        title: "Fee Optimized!",
        description: "AI has calculated the optimal assignment fee",
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Assignment Fee Optimizer</h1>
          <p className="text-muted-foreground">
            AI-powered pricing optimization for maximum profitability
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Optimize Assignment Fee</CardTitle>
            <CardDescription>Enter a lead ID to calculate optimal pricing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter Lead ID"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            />
            <Button onClick={optimizeFee} disabled={loading}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Optimize Fee
            </Button>
          </CardContent>
        </Card>

        {optimization && (
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <DollarSign className="h-5 w-5" />
                  Minimum Fee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${optimization.min_fee.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Floor price to maintain profitability
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  Recommended Fee
                </CardTitle>
                <Badge className="bg-green-500 w-fit">Optimal</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-green-600">
                  ${optimization.recommended_fee.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  AI-optimized pricing for this market
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <DollarSign className="h-5 w-5" />
                  Maximum Fee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${optimization.max_fee.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Ceiling before buyer resistance
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {optimization && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{optimization.reasoning}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}