/**
 * Floor9Predictions - AI Forward Intelligence
 * 
 * Part of Phase 9.1 — Shadow Mode governance
 * All predictions are recommendations only until trust thresholds are met.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShadowModeBanner } from "@/components/floor9";
import { Brain, TrendingUp, AlertTriangle, Activity, Target, Clock } from "lucide-react";

export default function Floor9Predictions() {
  return (
    <div className="space-y-6">
      <ShadowModeBanner />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <CardTitle>AI Predictions</CardTitle>
          </div>
          <CardDescription>
            Forward-looking intelligence — demand, risk, delays, and anomalies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-sm">Demand Forecast</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Predicts store demand, order volume, and delivery load.
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-sm">Risk Signals</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Flags churn risk, SLA misses, inventory shortfalls.
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-sm">Anomaly Detection</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Identifies unusual patterns in operations and sales.
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <CardTitle className="text-sm">Opportunity Scoring</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ranks leads, stores, and campaigns by conversion likelihood.
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <CardTitle className="text-sm">Delay Predictions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Forecasts delivery delays and fulfillment bottlenecks.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/50 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Shadow Mode Active</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All predictions operate as recommendations only until trust thresholds are met.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
