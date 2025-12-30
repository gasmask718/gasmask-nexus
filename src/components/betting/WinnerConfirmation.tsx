import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useConfirmedWinners, ConfirmWinnerInput, ConfirmedWinner } from '@/hooks/useConfirmedWinners';
import { useAIPredictionMemory, generateAIPrediction } from '@/hooks/useAIPredictionMemory';
import { format, subDays } from 'date-fns';
import {
  Home, Plane, CheckCircle, XCircle, CalendarIcon, Shield, Brain, Sparkles, Undo2, AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

// Get today's date in Eastern Time
const getEasternDate = (): string => {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return etFormatter.format(now);
};

interface GameData {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  winner: string | null;
}

interface AIPredictionDisplay {
  predictedWinner: string;
  probability: number;
  confidence: number;
  isStored: boolean;
  createdAt?: string;
}

interface EvaluationDisplay {
  aiResult: 'correct' | 'incorrect';
  aiPredictedWinner: string;
  confirmedWinner: string;
  isValid?: boolean;
}

interface GameConfirmCardProps {
  game: GameData;
  confirmationRecord?: ConfirmedWinner;
  confirmedWinner?: string;
  isConfirmed: boolean;
  isRevoked: boolean;
  aiPrediction?: AIPredictionDisplay;
  evaluation?: EvaluationDisplay;
  onConfirm: (winner: 'home' | 'away') => void;
  onUndo: (reason?: string) => void;
  isConfirming: boolean;
  isUndoing: boolean;
}

const GameConfirmCard = ({ 
  game, 
  confirmationRecord,
  confirmedWinner, 
  isConfirmed, 
  isRevoked,
  aiPrediction,
  evaluation,
  onConfirm,
  onUndo,
  isConfirming,
  isUndoing,
}: GameConfirmCardProps) => {
  const [selectedWinner, setSelectedWinner] = useState<'home' | 'away' | null>(null);
  const [undoReason, setUndoReason] = useState('');
  
  const isFinalStatus = game.status?.toLowerCase().includes('final') || 
                        game.status?.toLowerCase() === 'completed' ||
                        game.status?.toLowerCase() === 'f';

  // Check if this is a manual confirmation that can be undone
  const canUndo = isConfirmed && 
                  confirmationRecord?.confirmation_source === 'manual_admin' && 
                  !isRevoked;

  // Determine actual winner from scores if available
  const scoreBasedWinner = useMemo(() => {
    if (game.home_score !== null && game.away_score !== null) {
      return game.home_score > game.away_score ? game.home_team : game.away_team;
    }
    return game.winner;
  }, [game.home_score, game.away_score, game.home_team, game.away_team, game.winner]);

  const handleConfirmClick = () => {
    if (selectedWinner) {
      onConfirm(selectedWinner);
    }
  };

  const handleUndoClick = () => {
    onUndo(undoReason || undefined);
    setUndoReason('');
  };

  return (
    <Card className={`border-l-4 ${
      isRevoked ? 'border-l-orange-500 bg-orange-500/5' :
      isConfirmed ? 'border-l-green-500 bg-green-500/5' : 
      isFinalStatus ? 'border-l-blue-500' : 'border-l-yellow-500'
    }`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex flex-col gap-3">
          {/* Game Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{game.away_team}</span>
                {game.away_score !== null && (
                  <span className="text-lg font-bold">{game.away_score}</span>
                )}
              </div>
              <span className="text-muted-foreground">@</span>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{game.home_team}</span>
                {game.home_score !== null && (
                  <span className="text-lg font-bold">{game.home_score}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {game.status}
              </Badge>
              {isRevoked && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Revoked
                </Badge>
              )}
              {isConfirmed && !isRevoked && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Confirmed
                </Badge>
              )}
            </div>
          </div>

          {/* AI Prediction Display */}
          <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">AI Prediction</span>
              {aiPrediction?.isStored && (
                <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Stored
                </Badge>
              )}
            </div>
            {aiPrediction ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{aiPrediction.predictedWinner}</span>
                  <Badge className="bg-purple-500/20 text-purple-300">
                    {Math.round(aiPrediction.probability * 100)}% prob
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(aiPrediction.confidence * 100)}% conf
                  </Badge>
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No AI prediction recorded</span>
            )}
          </div>

          {/* Evaluation Result (after confirmation) */}
          {evaluation && !isRevoked && (
            <div className={`p-3 rounded-lg border ${
              !evaluation.isValid ? 'bg-gray-500/10 border-gray-500/30' :
              evaluation.aiResult === 'correct' 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!evaluation.isValid ? (
                    <AlertTriangle className="w-4 h-4 text-gray-400" />
                  ) : evaluation.aiResult === 'correct' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-sm font-medium">
                    AI Pick: <span className={
                      !evaluation.isValid ? 'text-gray-400' :
                      evaluation.aiResult === 'correct' ? 'text-green-400' : 'text-red-400'
                    }>
                      {evaluation.aiPredictedWinner}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Actual:</span>
                  <span className="font-medium">{evaluation.confirmedWinner}</span>
                  {!evaluation.isValid ? (
                    <Badge className="bg-gray-500/20 text-gray-400">
                      ⚠️ Invalidated
                    </Badge>
                  ) : (
                    <Badge className={`${
                      evaluation.aiResult === 'correct' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {evaluation.aiResult === 'correct' ? '✅ Correct' : '❌ Incorrect'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Revoked notice */}
          {isRevoked && confirmationRecord && (
            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-400">Confirmation Revoked</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Previous winner: {confirmationRecord.confirmed_winner}
                {confirmationRecord.revoke_reason && (
                  <span> • Reason: {confirmationRecord.revoke_reason}</span>
                )}
              </p>
            </div>
          )}

          {/* Score-based winner hint */}
          {scoreBasedWinner && !isConfirmed && !evaluation && (
            <div className="text-sm text-muted-foreground">
              Score indicates winner: <span className="text-primary font-medium">{scoreBasedWinner}</span>
            </div>
          )}

          {/* Confirmed Winner Display with Undo option */}
          {isConfirmed && confirmedWinner && !evaluation && !isRevoked && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">Winner Confirmed:</span>
                  <Badge className="bg-green-500/20 text-green-400">
                    {confirmedWinner}
                  </Badge>
                </div>
                {canUndo && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-orange-400 border-orange-400/50 hover:bg-orange-500/10">
                        <Undo2 className="w-3 h-3 mr-1" />
                        Undo
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Undo Winner Confirmation?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>This will revoke the manual confirmation for this game.</p>
                          <p>The AI evaluation will be invalidated and can be re-run after re-confirmation.</p>
                          <div className="mt-4">
                            <label className="text-sm font-medium">Reason (optional):</label>
                            <Textarea
                              value={undoReason}
                              onChange={(e) => setUndoReason(e.target.value)}
                              placeholder="e.g., Premature confirmation, AI prediction not yet logged..."
                              className="mt-2"
                            />
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleUndoClick}
                          disabled={isUndoing}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {isUndoing ? 'Undoing...' : 'Confirm Undo'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}

          {/* Confirm Winner Action - For Final games that aren't confirmed OR have been revoked */}
          {isFinalStatus && (!isConfirmed || isRevoked) && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">
                {isRevoked ? 'Re-confirm Winner:' : 'Confirm Winner:'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedWinner === 'away' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWinner('away')}
                  className="flex-1"
                >
                  <Plane className="w-4 h-4 mr-2" />
                  {game.away_team}
                </Button>
                <Button
                  variant={selectedWinner === 'home' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedWinner('home')}
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  {game.home_team}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirmClick}
                  disabled={!selectedWinner || isConfirming}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {isConfirming ? 'Confirming...' : (isRevoked ? 'Re-confirm' : 'Confirm')}
                </Button>
              </div>
            </div>
          )}

          {/* Not final yet */}
          {!isFinalStatus && (
            <div className="text-sm text-yellow-500 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Game not final - cannot confirm winner yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export function WinnerConfirmation() {
  const today = useMemo(() => getEasternDate(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => subDays(new Date(), 1)); // Default to yesterday
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  // Fetch games for selected date from nba_games_today
  const { data: games, isLoading: gamesLoading } = useQuery({
    queryKey: ['nba-games-for-confirmation', selectedDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_games_today')
        .select('*')
        .eq('game_date', selectedDateStr)
        .order('game_time', { ascending: true });
      
      if (error) throw error;
      return (data || []) as GameData[];
    }
  });

  // Use confirmed winners hook
  const { 
    confirmedWinners, 
    isLoading: confirmLoading, 
    confirmWinner, 
    undoConfirmation,
    isConfirming,
    isUndoing,
    getConfirmedWinnerByGameId,
    getConfirmationRecord,
  } = useConfirmedWinners({ 
    start: selectedDateStr, 
    end: selectedDateStr 
  });

  // Use AI prediction memory hook
  const {
    predictions,
    evaluations,
    isLoading: predictionsLoading,
    getPredictionByGameId,
    getEvaluationByGameId,
    storePredictions,
    evaluatePrediction,
    stats: aiStats,
  } = useAIPredictionMemory({
    start: selectedDateStr,
    end: selectedDateStr,
  });

  // Auto-store AI predictions for games on date change
  useEffect(() => {
    if (games && games.length > 0 && !predictionsLoading) {
      const gamesWithoutPredictions = games.filter(g => !getPredictionByGameId(g.game_id));
      if (gamesWithoutPredictions.length > 0) {
        storePredictions.mutate(
          gamesWithoutPredictions.map(g => ({
            game_id: g.game_id,
            game_date: g.game_date,
            home_team: g.home_team,
            away_team: g.away_team,
          }))
        );
      }
    }
  }, [games, predictionsLoading, selectedDateStr]);

  // Stats
  const stats = useMemo(() => {
    if (!games) return { total: 0, final: 0, confirmed: 0, pending: 0, aiCorrect: 0, aiIncorrect: 0 };
    
    const final = games.filter(g => 
      g.status?.toLowerCase().includes('final') || 
      g.status?.toLowerCase() === 'completed' ||
      g.status?.toLowerCase() === 'f'
    ).length;
    
    const confirmed = confirmedWinners?.length || 0;
    const aiCorrect = evaluations?.filter(e => e.ai_result === 'correct').length || 0;
    const aiIncorrect = evaluations?.filter(e => e.ai_result === 'incorrect').length || 0;
    
    return {
      total: games.length,
      final,
      confirmed,
      pending: final - confirmed,
      aiCorrect,
      aiIncorrect,
    };
  }, [games, confirmedWinners, evaluations]);

  const handleConfirmWinner = async (game: GameData, winner: 'home' | 'away') => {
    const confirmedWinnerTeam = winner === 'home' ? game.home_team : game.away_team;
    
    const input: ConfirmWinnerInput = {
      game_id: game.game_id,
      game_date: game.game_date,
      home_team: game.home_team,
      away_team: game.away_team,
      home_score: game.home_score,
      away_score: game.away_score,
      confirmed_winner: confirmedWinnerTeam,
    };
    
    // Confirm winner first
    await confirmWinner.mutateAsync(input);
    
    // Then evaluate AI prediction
    await evaluatePrediction.mutateAsync({
      game_id: game.game_id,
      game_date: game.game_date,
      confirmed_winner: confirmedWinnerTeam,
    });
  };

  const isLoading = gamesLoading || confirmLoading || predictionsLoading;

  // Get AI prediction display for a game
  const getAIPredictionDisplay = (game: GameData): AIPredictionDisplay | undefined => {
    const storedPrediction = getPredictionByGameId(game.game_id);
    
    if (storedPrediction) {
      return {
        predictedWinner: storedPrediction.ai_predicted_winner,
        probability: storedPrediction.ai_predicted_probability || 0,
        confidence: storedPrediction.ai_confidence_score || 0,
        isStored: true,
      };
    }
    
    // Generate on-the-fly if not stored
    const generated = generateAIPrediction(game.home_team, game.away_team);
    return {
      predictedWinner: generated.ai_predicted_winner,
      probability: generated.ai_predicted_probability,
      confidence: generated.ai_confidence_score,
      isStored: false,
    };
  };

  // Get evaluation display for a game
  const getEvaluationDisplay = (game: GameData): EvaluationDisplay | undefined => {
    const evaluation = getEvaluationByGameId(game.game_id);
    
    if (evaluation) {
      return {
        aiResult: evaluation.ai_result,
        aiPredictedWinner: evaluation.ai_predicted_winner,
        confirmedWinner: evaluation.confirmed_winner,
        isValid: (evaluation as any).is_valid !== false,
      };
    }
    
    return undefined;
  };

  // Handle undo confirmation
  const handleUndoConfirmation = async (game: GameData, reason?: string) => {
    await undoConfirmation.mutateAsync({
      game_id: game.game_id,
      reason,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with date picker */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Manual Winner Confirmation
          </h3>
          <p className="text-sm text-muted-foreground">
            Confirm actual winners and evaluate AI predictions
          </p>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => date > new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Games</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.final}</p>
            <p className="text-xs text-muted-foreground">Final</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.confirmed}</p>
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.aiCorrect}</p>
            <p className="text-xs text-muted-foreground">AI Correct</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.aiIncorrect}</p>
            <p className="text-xs text-muted-foreground">AI Incorrect</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Accuracy Summary */}
      {(stats.aiCorrect + stats.aiIncorrect) > 0 && (
        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-purple-400">AI Accuracy for {format(selectedDate, 'MMM d')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  {stats.aiCorrect}/{stats.aiCorrect + stats.aiIncorrect} correct
                </span>
                <Badge className="bg-purple-500/20 text-purple-300 text-lg px-3">
                  {Math.round((stats.aiCorrect / (stats.aiCorrect + stats.aiIncorrect)) * 100)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Games List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !games || games.length === 0 ? (
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No games found for {selectedDateStr}</p>
          <p className="text-sm text-muted-foreground mt-1">Try selecting a different date</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {games.map((game) => {
              const confirmed = getConfirmedWinnerByGameId(game.game_id);
              const confirmationRecord = getConfirmationRecord(game.game_id);
              const aiPrediction = getAIPredictionDisplay(game);
              const evaluation = getEvaluationDisplay(game);
              const isRevoked = confirmationRecord?.confirmation_revoked === true;
              
              return (
                <GameConfirmCard
                  key={game.id}
                  game={game}
                  confirmationRecord={confirmationRecord}
                  confirmedWinner={confirmed?.confirmed_winner}
                  isConfirmed={!!confirmed}
                  isRevoked={isRevoked}
                  aiPrediction={aiPrediction}
                  evaluation={evaluation}
                  onConfirm={(winner) => handleConfirmWinner(game, winner)}
                  onUndo={(reason) => handleUndoConfirmation(game, reason)}
                  isConfirming={isConfirming}
                  isUndoing={isUndoing}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Info */}
      <div className="p-3 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-start gap-2">
          <Brain className="w-4 h-4 text-purple-400 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">AI Prediction Memory</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>AI predictions are automatically stored for all games</li>
              <li>When you confirm a winner, the system evaluates the AI's prediction</li>
              <li>Results (correct/incorrect) are tracked for learning</li>
              <li>Historical accuracy is used to improve future predictions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WinnerConfirmation;
