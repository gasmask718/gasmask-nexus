import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Shield } from "lucide-react";

export default function HedgeCenter() {
  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-emerald-950/10">
      <div>
        <h1 className="text-3xl font-bold">Hedge Center</h1>
        <p className="text-muted-foreground">Calculate optimal hedge positions</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-500" />
              Hedge Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Original Bet Amount ($)</label>
              <input type="number" placeholder="500" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Original Odds (American)</label>
              <input type="text" placeholder="+250" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Hedge Odds (American)</label>
              <input type="text" placeholder="-150" className="w-full mt-1 p-3 rounded-lg bg-muted/50 border border-border/50" />
            </div>
            <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-500">
              Calculate Optimal Hedge
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hedge Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">Enter your bet details to calculate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        For informational and entertainment purposes only. Not a sportsbook.
      </p>
    </div>
  );
}
