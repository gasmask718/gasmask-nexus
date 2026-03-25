import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DynamicCallScripts } from './DynamicCallScripts';
import { AICoachingCards } from './AICoachingCards';
import { ObjectionLibrary } from './ObjectionLibrary';
import { CallScoring } from './CallScoring';
import { Leaderboard } from './Leaderboard';
import { BookOpen, Brain, MessageSquare, Star, Trophy } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

interface SalesMasteryEngineProps {
  hub: Hub;
  accentColor: string;
}

export function SalesMasteryEngine({ hub, accentColor }: SalesMasteryEngineProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
          <BookOpen className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: accentColor }}>Sales Mastery Engine</h2>
          <p className="text-xs text-muted-foreground">The #1 closer system — scripts, coaching, scoring & rankings</p>
        </div>
      </div>

      <Tabs defaultValue="scripts">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="scripts" className="text-xs gap-1">
            <BookOpen className="h-3 w-3" />Scripts
          </TabsTrigger>
          <TabsTrigger value="coaching" className="text-xs gap-1">
            <Brain className="h-3 w-3" />Coaching
          </TabsTrigger>
          <TabsTrigger value="objections" className="text-xs gap-1">
            <MessageSquare className="h-3 w-3" />Objections
          </TabsTrigger>
          <TabsTrigger value="scoring" className="text-xs gap-1">
            <Star className="h-3 w-3" />Scoring
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs gap-1">
            <Trophy className="h-3 w-3" />Rankings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scripts" className="mt-3">
          <DynamicCallScripts hub={hub} accentColor={accentColor} />
        </TabsContent>

        <TabsContent value="coaching" className="mt-3">
          <AICoachingCards hub={hub} accentColor={accentColor} />
        </TabsContent>

        <TabsContent value="objections" className="mt-3">
          <ObjectionLibrary hub={hub} accentColor={accentColor} />
        </TabsContent>

        <TabsContent value="scoring" className="mt-3">
          <CallScoring hub={hub} accentColor={accentColor} />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-3">
          <Leaderboard hub={hub} accentColor={accentColor} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
