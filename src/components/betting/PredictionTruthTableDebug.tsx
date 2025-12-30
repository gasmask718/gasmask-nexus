import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AlertTriangle, CheckCircle, XCircle, Database, ChevronDown, Bug } from 'lucide-react';

interface TruthTableRow {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  // Source A: ai_game_predictions table (canonical)
  sourceA_prediction: string | null;
  sourceA_probability: number | null;
  sourceA_locked_at: string | null;
  // Source B: daily_prediction_snapshots table (should be synced)
  sourceB_prediction: string | null;
  // Source C: confirmed winner
  sourceC_confirmed: string | null;
  sourceC_revoked: boolean;
  // Computed correctness
  computed_correct: boolean | null;
  // Duplicate count in ai_game_predictions
  duplicate_count: number;
  // Mismatch detected
  has_mismatch: boolean;
}

interface PredictionTruthTableDebugProps {
  selectedDate: string;
  games: Array<{
    game_id: string;
    home_team: string;
    away_team: string;
    game_date: string;
  }>;
}

export function PredictionTruthTableDebug({ selectedDate, games }: PredictionTruthTableDebugProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all prediction sources for comparison
  const { data: truthTable, isLoading } = useQuery({
    queryKey: ['prediction-truth-table', selectedDate],
    queryFn: async (): Promise<TruthTableRow[]> => {
      if (!games || games.length === 0) return [];

      const gameIds = games.map(g => g.game_id);

      // Fetch from ai_game_predictions (Source A - Canonical)
      const { data: aiPredictions } = await supabase
        .from('ai_game_predictions')
        .select('game_id, ai_predicted_winner, ai_predicted_probability, locked_at')
        .in('game_id', gameIds);

      // Fetch from daily_prediction_snapshots (Source B)
      const { data: snapshots } = await supabase
        .from('daily_prediction_snapshots')
        .select('game_id, predicted_winner')
        .eq('snapshot_date', selectedDate);

      // Fetch confirmed winners (Source C)
      const { data: confirmations } = await supabase
        .from('confirmed_game_winners')
        .select('game_id, confirmed_winner, confirmation_revoked')
        .in('game_id', gameIds);

      // Check for duplicates in ai_game_predictions
      const { data: duplicateCounts } = await supabase
        .from('ai_game_predictions')
        .select('game_id')
        .in('game_id', gameIds);

      const duplicateMap = new Map<string, number>();
      duplicateCounts?.forEach(row => {
        duplicateMap.set(row.game_id, (duplicateMap.get(row.game_id) || 0) + 1);
      });

      // Build truth table
      return games.map(game => {
        const aiPred = aiPredictions?.find(p => p.game_id === game.game_id);
        const snapshot = snapshots?.find(s => s.game_id === game.game_id);
        const confirmation = confirmations?.find(c => c.game_id === game.game_id);
        const dupCount = duplicateMap.get(game.game_id) || 0;

        const sourceA = aiPred?.ai_predicted_winner || null;
        const sourceB = snapshot?.predicted_winner || null;
        const sourceC = confirmation?.confirmed_winner || null;
        const isRevoked = confirmation?.confirmation_revoked || false;

        // Check for mismatch between sources
        const hasMismatch = sourceA && sourceB && sourceA !== sourceB;

        // Compute correctness (only if not revoked and we have both prediction and confirmation)
        let computedCorrect: boolean | null = null;
        if (sourceA && sourceC && !isRevoked) {
          computedCorrect = sourceA === sourceC;
        }

        return {
          game_id: game.game_id,
          game_date: game.game_date,
          home_team: game.home_team,
          away_team: game.away_team,
          sourceA_prediction: sourceA,
          sourceA_probability: aiPred?.ai_predicted_probability || null,
          sourceA_locked_at: aiPred?.locked_at || null,
          sourceB_prediction: sourceB,
          sourceC_confirmed: sourceC,
          sourceC_revoked: isRevoked,
          computed_correct: computedCorrect,
          duplicate_count: dupCount,
          has_mismatch: !!hasMismatch,
        };
      });
    },
    enabled: games.length > 0,
  });

  const hasMismatches = truthTable?.some(r => r.has_mismatch) || false;
  const hasDuplicates = truthTable?.some(r => r.duplicate_count > 1) || false;
  const hasIssues = hasMismatches || hasDuplicates;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border ${hasIssues ? 'border-orange-500/50 bg-orange-500/5' : 'border-muted'}`}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="w-4 h-4 text-muted-foreground" />
                Truth Table Debug (Admin Only)
                {hasIssues && (
                  <Badge className="bg-orange-500/20 text-orange-400 ml-2">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Issues Detected
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading truth table...</div>
            ) : !truthTable || truthTable.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">No games to analyze</div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {truthTable.map(row => (
                    <div 
                      key={row.game_id} 
                      className={`p-3 rounded-lg border text-xs ${
                        row.has_mismatch || row.duplicate_count > 1 
                          ? 'bg-orange-500/10 border-orange-500/30' 
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      {/* Game Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {row.away_team} @ {row.home_team}
                        </span>
                        <span className="text-muted-foreground">{row.game_id}</span>
                      </div>

                      {/* Source Comparison Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {/* Source A */}
                        <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                          <div className="flex items-center gap-1 mb-1">
                            <Database className="w-3 h-3 text-purple-400" />
                            <span className="font-medium text-purple-400">Source A (Canonical)</span>
                          </div>
                          <div className="text-foreground">
                            {row.sourceA_prediction || <span className="text-muted-foreground italic">Not recorded</span>}
                          </div>
                          {row.sourceA_locked_at && (
                            <div className="text-muted-foreground mt-1">
                              🔒 Locked
                            </div>
                          )}
                        </div>

                        {/* Source B */}
                        <div className={`p-2 rounded border ${
                          row.has_mismatch ? 'bg-orange-500/10 border-orange-500/30' : 'bg-blue-500/10 border-blue-500/30'
                        }`}>
                          <div className="flex items-center gap-1 mb-1">
                            <Database className="w-3 h-3 text-blue-400" />
                            <span className="font-medium text-blue-400">Source B (Snapshot)</span>
                          </div>
                          <div className="text-foreground">
                            {row.sourceB_prediction || <span className="text-muted-foreground italic">Not recorded</span>}
                          </div>
                          {row.has_mismatch && (
                            <div className="text-orange-400 mt-1">
                              ⚠️ Mismatch!
                            </div>
                          )}
                        </div>

                        {/* Source C */}
                        <div className={`p-2 rounded border ${
                          row.sourceC_revoked ? 'bg-gray-500/10 border-gray-500/30' : 'bg-green-500/10 border-green-500/30'
                        }`}>
                          <div className="flex items-center gap-1 mb-1">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="font-medium text-green-400">Source C (Confirmed)</span>
                          </div>
                          <div className="text-foreground">
                            {row.sourceC_confirmed || <span className="text-muted-foreground italic">Not confirmed</span>}
                          </div>
                          {row.sourceC_revoked && (
                            <div className="text-gray-400 mt-1">
                              ❌ Revoked
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Computed Result */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Correctness (A==C):</span>
                          {row.computed_correct === null ? (
                            <Badge variant="outline" className="text-xs">N/A</Badge>
                          ) : row.computed_correct ? (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Correct
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 text-xs">
                              <XCircle className="w-3 h-3 mr-1" />
                              Incorrect
                            </Badge>
                          )}
                        </div>
                        
                        {/* Duplicate Warning */}
                        {row.duplicate_count > 1 && (
                          <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {row.duplicate_count} duplicate predictions
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Legend */}
            <div className="mt-3 p-2 bg-muted/30 rounded border border-border text-xs text-muted-foreground">
              <p className="font-medium mb-1">Sources Explained:</p>
              <ul className="space-y-0.5">
                <li><span className="text-purple-400">Source A</span>: ai_game_predictions table (canonical, immutable)</li>
                <li><span className="text-blue-400">Source B</span>: daily_prediction_snapshots (should match A)</li>
                <li><span className="text-green-400">Source C</span>: confirmed_game_winners (actual result)</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
