import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, User } from 'lucide-react';
import { MoneylineResultsTab, PropResultsTab } from '@/components/betting/results';

export default function ResultsPage() {
  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-amber-950/10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
          Settled Results
        </h1>
        <p className="text-muted-foreground mt-1">
          Read-only view of all settled moneyline and prop outcomes
        </p>
      </div>

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
          <MoneylineResultsTab />
        </TabsContent>

        <TabsContent value="props">
          <PropResultsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
