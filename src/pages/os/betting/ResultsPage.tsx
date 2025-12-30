import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, User, TrendingUp, Target } from 'lucide-react';
import { MoneylineResultsTab, PropResultsTab } from '@/components/betting/results';
import { useSimplifiedAccuracy } from '@/hooks/useSimplifiedAccuracy';
import { Badge } from '@/components/ui/badge';

export default function ResultsPage() {
  const { data: accuracy, isLoading: accuracyLoading } = useSimplifiedAccuracy();

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-amber-950/10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
          Settled Results
        </h1>
        <p className="text-muted-foreground mt-1">
          Immutable, read-only ledger of all settled moneyline and prop outcomes
        </p>
      </div>

      {/* Accuracy Overview */}
      {!accuracyLoading && accuracy && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/30">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Combined Win Rate</p>
                  <p className="text-3xl font-bold">{accuracy.combined.winRate.toFixed(1)}%</p>
                </div>
                <Target className="h-8 w-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {accuracy.combined.wins}W - {accuracy.combined.losses}L
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Moneyline</p>
                  <p className="text-2xl font-bold">{accuracy.moneyline.winRate.toFixed(1)}%</p>
                </div>
                <Trophy className="h-6 w-6 text-amber-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {accuracy.moneyline.wins}W - {accuracy.moneyline.losses}L ({accuracy.moneyline.total} games)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Props</p>
                  <p className="text-2xl font-bold">{accuracy.props.winRate.toFixed(1)}%</p>
                </div>
                <User className="h-6 w-6 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {accuracy.props.wins}W - {accuracy.props.losses}L ({accuracy.props.total} props)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Settled</p>
                  <p className="text-2xl font-bold">{accuracy.combined.total}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-green-500 opacity-50" />
              </div>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-xs">ML: {accuracy.moneyline.total}</Badge>
                <Badge variant="outline" className="text-xs">Props: {accuracy.props.total}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two Clear Categories */}
      <Tabs defaultValue="moneyline" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="moneyline" className="gap-2">
            <Trophy className="h-4 w-4" />
            Moneyline Results
          </TabsTrigger>
          <TabsTrigger value="props" className="gap-2">
            <User className="h-4 w-4" />
            Prop Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="moneyline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Moneyline Results Ledger
              </CardTitle>
              <CardDescription>
                Game winner predictions. Source: Final game scores. Written once, read-only forever.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MoneylineResultsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="props">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                Prop Results Ledger
              </CardTitle>
              <CardDescription>
                Player prop predictions. Source: Final box score stats only. Written once, read-only forever.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PropResultsTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
