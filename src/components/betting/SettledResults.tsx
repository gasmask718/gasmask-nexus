import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useFinalResults } from '@/hooks/useFinalResults';
import { format, subDays } from 'date-fns';
import {
  Home, Plane, CheckCircle, XCircle, CalendarIcon, Brain, Trophy, TrendingUp
} from 'lucide-react';
import { useState } from 'react';

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

interface ResultCardProps {
  result: {
    id: string;
    game_id: string;
    game_date: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    ai_predicted_winner: string | null;
    actual_winner: string;
    is_correct: boolean | null;
    ai_probability: number | null;
    ai_confidence_score: number | null;
    settled_at: string;
  };
}

const ResultCard = ({ result }: ResultCardProps) => {
  const hasAIPrediction = result.ai_predicted_winner !== null;
  const isCorrect = result.is_correct === true;
  const isIncorrect = result.is_correct === false;
  
  return (
    <Card className={`border-l-4 ${
      !hasAIPrediction ? 'border-l-gray-500' :
      isCorrect ? 'border-l-green-500' :
      isIncorrect ? 'border-l-red-500' :
      'border-l-yellow-500'
    }`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex flex-col gap-3">
          {/* Game Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-muted-foreground" />
                <span className={`font-medium ${result.actual_winner === result.away_team ? 'text-primary' : ''}`}>
                  {result.away_team}
                </span>
                {result.away_score !== null && (
                  <span className="text-lg font-bold">{result.away_score}</span>
                )}
              </div>
              <span className="text-muted-foreground">@</span>
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-muted-foreground" />
                <span className={`font-medium ${result.actual_winner === result.home_team ? 'text-primary' : ''}`}>
                  {result.home_team}
                </span>
                {result.home_score !== null && (
                  <span className="text-lg font-bold">{result.home_score}</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                <Trophy className="w-3 h-3 mr-1" />
                {result.actual_winner}
              </Badge>
            </div>
          </div>

          {/* AI Prediction Display - Read-Only */}
          <div className={`p-3 rounded-lg border ${
            !hasAIPrediction ? 'bg-gray-500/10 border-gray-500/30' :
            isCorrect ? 'bg-green-500/10 border-green-500/30' :
            'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">AI Prediction</span>
            </div>
            {hasAIPrediction ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.ai_predicted_winner}</span>
                  {result.ai_probability !== null && (
                    <Badge className="bg-purple-500/20 text-purple-300">
                      {Math.round(result.ai_probability * 100)}% prob
                    </Badge>
                  )}
                  {result.ai_confidence_score !== null && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(result.ai_confidence_score * 100)}% conf
                    </Badge>
                  )}
                </div>
                <Badge className={isCorrect 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
                }>
                  {isCorrect ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Correct
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Incorrect
                    </>
                  )}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                No AI prediction recorded for this game
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function SettledResults() {
  const today = useMemo(() => getEasternDate(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => subDays(new Date(), 1));
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  // Use final results hook - the single source of truth
  const { results, isLoading, stats, statsByConfidence } = useFinalResults({
    start: selectedDateStr,
    end: selectedDateStr,
    sport: 'NBA'
  });

  // Stats for the selected date
  const dateStats = useMemo(() => {
    if (!results) return { total: 0, withPrediction: 0, correct: 0, incorrect: 0 };
    
    const withPrediction = results.filter(r => r.ai_predicted_winner !== null);
    const correct = withPrediction.filter(r => r.is_correct === true).length;
    const incorrect = withPrediction.filter(r => r.is_correct === false).length;
    
    return {
      total: results.length,
      withPrediction: withPrediction.length,
      correct,
      incorrect
    };
  }, [results]);

  const accuracy = dateStats.withPrediction > 0 
    ? ((dateStats.correct / dateStats.withPrediction) * 100).toFixed(1) 
    : 'N/A';

  return (
    <div className="space-y-4">
      {/* Header with date picker and stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-sm text-muted-foreground">
            Final Results (Read-Only)
          </span>
        </div>
        
        {/* Stats summary */}
        {dateStats.total > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {dateStats.total} games
            </Badge>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
              <CheckCircle className="w-3 h-3 mr-1" />
              {dateStats.correct}W
            </Badge>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
              <XCircle className="w-3 h-3 mr-1" />
              {dateStats.incorrect}L
            </Badge>
            <Badge className="bg-primary/20 text-primary">
              <TrendingUp className="w-3 h-3 mr-1" />
              {accuracy}%
            </Badge>
          </div>
        )}
      </div>

      {/* Results list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !results || results.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No settled results for {selectedDateStr}</p>
          <p className="text-sm text-muted-foreground mt-1">Results appear here after games are automatically settled</p>
        </div>
      ) : (
        <ScrollArea className="h-[450px]">
          <div className="space-y-3">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
