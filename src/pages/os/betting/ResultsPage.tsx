import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, User, Lock } from 'lucide-react';
import { MoneylineResultsTab, PropResultsTab } from '@/components/betting/results';
import { useSimplifiedAccuracy } from '@/hooks/useSimplifiedAccuracy';
import { Badge } from '@/components/ui/badge';

export default function ResultsPage() {
  const { data: accuracy, isLoading: accuracyLoading } = useSimplifiedAccuracy();

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-amber-950/10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Settlement Results
          </h1>
          <p className="text-muted-foreground mt-1">
            Direct mirror of settlement tables. Read-only. No joins, no inference.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 text-sm">
          <Lock className="h-3 w-3" />
          Immutable
        </Badge>
      </div>

      {/* Quick Stats */}
      {!accuracyLoading && accuracy && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Moneyline Settled</p>
                  <p className="text-3xl font-bold">{accuracy.moneyline.total}</p>
                </div>
                <Trophy className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Games with confirmed winners
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Props Settled</p>
                  <p className="text-3xl font-bold">{accuracy.props.total}</p>
                </div>
                <User className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Player props with final stats
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two Clear Categories */}
      <Tabs defaultValue="moneyline" className="space-y-4">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="moneyline" className="gap-2">
            <Trophy className="h-4 w-4" />
            Moneyline Settlement
          </TabsTrigger>
          <TabsTrigger value="props" className="gap-2">
            <User className="h-4 w-4" />
            Prop Settlement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="moneyline">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Moneyline Settlement Mirror
              </CardTitle>
              <CardDescription>
                Direct query from confirmed_game_winners. Source of truth for game outcomes.
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
                Prop Settlement Mirror
              </CardTitle>
              <CardDescription>
                Direct query from prop_results. Source of truth for player prop outcomes.
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
