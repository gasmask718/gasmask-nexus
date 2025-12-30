import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserRole } from '@/hooks/useUserRole';
import { useStateCompliance } from '@/hooks/useStateCompliance';
import { useAuth } from '@/contexts/AuthContext';
import { useMoneylineSettlement } from '@/hooks/useMoneylineSettlement';
import { format, subDays } from 'date-fns';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown,
  Home, Plane, AlertTriangle, CheckCircle, XCircle, Info,
  CalendarIcon, Trophy, Save, Clock, Zap, Shield
} from 'lucide-react';
import SettledResults from './SettledResults';
import { toast } from 'sonner';

// Get today's date in Eastern Time (NBA's reference timezone)
const getEasternDate = (): string => {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return etFormatter.format(now); // Returns YYYY-MM-DD
};

// Normalize any input into a single internal ISO-8601 UTC timestamp ending in "Z"
const toUtcIso = (raw: string | null): string | null => {
  if (!raw) return null;
  let s = String(raw).trim();
  if (/\bET\b|\bEST\b|\bEDT\b/i.test(s)) return null;
  s = s.replace(' ', 'T');
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    s = `${s}Z`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const formatEtFromUtcIso = (utcIso: string | null): string => {
  if (!utcIso) return 'TBD';
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return (
    d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' ET'
  );
};

const formatGameTimeET = (gameTime: string | null): string => {
  const utcIso = toUtcIso(gameTime);
  return formatEtFromUtcIso(utcIso);
};

interface MoneylinePrediction {
  id: string;
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  game_time: string | null;
  home_net_rating: number | null;
  away_net_rating: number | null;
  home_off_rating: number | null;
  away_off_rating: number | null;
  home_def_rating: number | null;
  away_def_rating: number | null;
  home_pace: number | null;
  away_pace: number | null;
  home_back_to_back: boolean;
  away_back_to_back: boolean;
  home_win_probability: number | null;
  away_win_probability: number | null;
  predicted_winner: string | null;
  confidence_score: number | null;
  recommendation: string | null;
  reasoning: string | null;
  calibration_factors: Record<string, unknown>;
  generated_at: string | null;
}

interface MoneylineEntry {
  id: string;
  date: string;
  team: string;
  opponent: string;
  side: string; // 'HOME' or 'AWAY'
  status: string;
  result: string | null;
  profit_loss: number;
  notes: string | null;
  decision_source: string;
  locked_at: string | null;
  actual_result_value: number | null;
}

const getRecommendationBadge = (rec: string | null) => {
  switch (rec) {
    case 'strong_lean':
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Strong Lean</Badge>;
    case 'lean':
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Lean</Badge>;
    case 'slight_lean':
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Slight Lean</Badge>;
    case 'no_edge':
      return <Badge className="bg-muted text-muted-foreground">No Edge</Badge>;
    case 'avoid':
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/50">Avoid</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const NetRatingDisplay = ({ rating, label }: { rating: number | null; label: string }) => {
  if (rating === null) return null;
  const isPositive = rating > 0;
  const Icon = isPositive ? TrendingUp : rating < 0 ? TrendingDown : Minus;
  const colorClass = isPositive ? 'text-green-400' : rating < 0 ? 'text-red-400' : 'text-muted-foreground';
  
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Icon className={`w-3 h-3 ${colorClass}`} />
      <span className={`text-sm font-mono ${colorClass}`}>{rating > 0 ? '+' : ''}{rating.toFixed(1)}</span>
    </div>
  );
};

// Card for displaying a moneyline prediction
const MoneylineCard = ({ 
  prediction, 
  expanded, 
  onToggle, 
  showTimeDebug,
  isPersisted,
}: {
  prediction: MoneylinePrediction;
  expanded: boolean;
  onToggle: () => void;
  showTimeDebug: boolean;
  isPersisted: boolean;
}) => {
  const homeProb = prediction.home_win_probability ? (prediction.home_win_probability * 100).toFixed(1) : 'N/A';
  const awayProb = prediction.away_win_probability ? (prediction.away_win_probability * 100).toFixed(1) : 'N/A';
  const isHomeFavored = (prediction.home_win_probability || 0) >= (prediction.away_win_probability || 0);

  const raw_api_time = prediction.game_time;
  const parsed_utc_time = toUtcIso(raw_api_time);
  const rendered_et_time = formatEtFromUtcIso(parsed_utc_time);

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className={`border-l-4 ${
        prediction.recommendation === 'strong_lean' ? 'border-l-green-500' :
        prediction.recommendation === 'lean' ? 'border-l-blue-500' :
        prediction.recommendation === 'slight_lean' ? 'border-l-yellow-500' :
        prediction.recommendation === 'avoid' ? 'border-l-red-500' :
        'border-l-border'
      }`}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-muted-foreground" />
                    <span className={`font-medium ${!isHomeFavored ? 'text-primary' : ''}`}>
                      {prediction.away_team}
                    </span>
                    <span className="text-sm text-muted-foreground">({awayProb}%)</span>
                  </div>
                  <span className="text-muted-foreground">@</span>
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <span className={`font-medium ${isHomeFavored ? 'text-primary' : ''}`}>
                      {prediction.home_team}
                    </span>
                    <span className="text-sm text-muted-foreground">({homeProb}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">{rendered_et_time}</span>
                  {getRecommendationBadge(prediction.recommendation)}
                  {prediction.confidence_score && (
                    <Badge variant="outline" className="text-xs">
                      {prediction.confidence_score.toFixed(0)}% conf
                    </Badge>
                  )}
                  {isPersisted && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">
                      <Save className="w-3 h-3 mr-1" />
                      Saved
                    </Badge>
                  )}
                  {prediction.home_back_to_back && (
                    <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/50">
                      {prediction.home_team} B2B
                    </Badge>
                  )}
                  {prediction.away_back_to_back && (
                    <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/50">
                      {prediction.away_team} B2B
                    </Badge>
                  )}
                </div>

                {showTimeDebug && (
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
                    raw_api_time: {String(raw_api_time ?? 'null')} | parsed_utc_time: {String(parsed_utc_time ?? 'null')} | rendered_et_time: {rendered_et_time}
                  </div>
                )}
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 border-t border-border">
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Away Team Stats */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Plane className="w-4 h-4" />
                  {prediction.away_team}
                </h4>
                <div className="space-y-1 text-sm">
                  <NetRatingDisplay rating={prediction.away_net_rating} label="Net Rtg" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Off Rtg:</span>
                    <span className="font-mono">{prediction.away_off_rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Def Rtg:</span>
                    <span className="font-mono">{prediction.away_def_rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Pace:</span>
                    <span className="font-mono">{prediction.away_pace?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              {/* Home Team Stats */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  {prediction.home_team}
                </h4>
                <div className="space-y-1 text-sm">
                  <NetRatingDisplay rating={prediction.home_net_rating} label="Net Rtg" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Off Rtg:</span>
                    <span className="font-mono">{prediction.home_off_rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Def Rtg:</span>
                    <span className="font-mono">{prediction.home_def_rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Pace:</span>
                    <span className="font-mono">{prediction.home_pace?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {prediction.reasoning && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">{prediction.reasoning}</p>
                </div>
              </div>
            )}
            
            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="font-medium">Predicted Winner:</span>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/50">
                  {prediction.predicted_winner}
                </Badge>
              </div>
            </div>

            
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Low-variance prediction. Max probability capped at 70%.</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Card for displaying a settled moneyline entry
const SettledEntryCard = ({ entry }: { entry: MoneylineEntry }) => {
  const isWin = entry.result === 'W';
  const isLoss = entry.result === 'L';
  const isPush = entry.result === 'P';
  
  return (
    <Card className={`border-l-4 ${
      isWin ? 'border-l-green-500' :
      isLoss ? 'border-l-red-500' :
      isPush ? 'border-l-yellow-500' :
      'border-l-border'
    }`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium text-primary">{entry.team}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{entry.opponent}</span>
              <Badge variant="outline" className="text-xs">
                {entry.side}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{entry.date}</span>
              <Badge className={
                isWin ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                isLoss ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                isPush ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' :
                'bg-muted text-muted-foreground'
              }>
                {entry.result || 'Pending'}
              </Badge>
              {entry.profit_loss !== 0 && (
                <span className={`text-sm font-mono ${entry.profit_loss > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.profit_loss > 0 ? '+' : ''}{entry.profit_loss.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          {isWin && <Trophy className="w-5 h-5 text-green-400" />}
          {isLoss && <XCircle className="w-5 h-5 text-red-400" />}
        </div>
      </CardContent>
    </Card>
  );
};

const NBAMoneylineLeans = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'settlement' | 'settled' | 'results'>('open');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [validationStatus, setValidationStatus] = useState<{
    expectedCount: number | null;
    mismatch: boolean;
  }>({ expectedCount: null, mismatch: false });

  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const { userStateProfile } = useStateCompliance();
  const queryClient = useQueryClient();
  const showTimeDebug = isAdmin();
  
  // Auto-settlement hook - runs on load and every 15 minutes
  const { 
    runSettlement, 
    isSettling, 
    lastSettlementRun, 
    finalGamesCount, 
    openEntriesCount,
    openEntries: allOpenEntries,
    finalGames,
  } = useMoneylineSettlement();
  
  const today = useMemo(() => getEasternDate(), []);
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const isToday = selectedDateStr === today;
  
  // Fetch expected game count from nba_games_today for validation
  const { data: expectedGames } = useQuery({
    queryKey: ['nba-games-today-count', selectedDateStr],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('nba_games_today')
        .select('*', { count: 'exact' })
        .eq('game_date', selectedDateStr);
      
      if (error) {
        console.error('Error fetching expected games:', error);
        return [];
      }
      return data || [];
    }
  });
  
  // Fetch moneyline predictions for selected date
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = useQuery({
    queryKey: ['nba-moneyline-predictions', selectedDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_moneyline_predictions')
        .select('*')
        .eq('game_date', selectedDateStr)
        .order('game_time', { ascending: true });
      
      if (error) throw error;
      
      if (expectedGames) {
        const expectedCount = expectedGames.length;
        const actualCount = data?.length || 0;
        const hasMismatch = expectedCount !== actualCount && expectedCount > 0;
        
        if (hasMismatch) {
          console.warn(`[Moneyline Validation] Game count mismatch: Expected ${expectedCount}, got ${actualCount}`);
        }
        
        setValidationStatus({ expectedCount, mismatch: hasMismatch });
      }
      
      return data as MoneylinePrediction[];
    },
    enabled: !!expectedGames
  });

  // Fetch persisted moneyline entries (pick_entries with market = 'Moneyline')
  const { data: moneylineEntries, isLoading: entriesLoading, refetch: refetchEntries } = useQuery({
    queryKey: ['moneyline-entries', selectedDateStr, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('pick_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('market', 'Moneyline')
        .eq('date', selectedDateStr)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as MoneylineEntry[];
    },
    enabled: !!user?.id
  });

  // Split entries by status
  const openEntries = useMemo(() => 
    moneylineEntries?.filter(e => e.status === 'open') || [], 
    [moneylineEntries]
  );
  const settledEntries = useMemo(() => 
    moneylineEntries?.filter(e => e.status === 'settled') || [], 
    [moneylineEntries]
  );

  // Map prediction IDs to entry IDs for "Saved" badge
  const predictionToEntryMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (predictions && moneylineEntries) {
      for (const entry of moneylineEntries) {
        // Match by team + opponent + date
        const matchingPred = predictions.find(p => 
          (p.predicted_winner === entry.team && 
           (p.home_team === entry.opponent || p.away_team === entry.opponent))
        );
        if (matchingPred) {
          map[matchingPred.id] = entry.id;
        }
      }
    }
    return map;
  }, [predictions, moneylineEntries]);

  // Persist predictions mutation
  const persistPredictions = useMutation({
    mutationFn: async (preds: MoneylinePrediction[]) => {
      if (!user?.id) {
        throw new Error('User not authenticated. Please log in to save entries.');
      }
      
      const userState = userStateProfile?.user_state || 'NY';
      // Use platform_key (slug) that matches the platforms table FK
      const platformKey = userState === 'NY' ? 'draftkings' : 'fanduel';
      
      const entries = preds
        .filter(p => p.predicted_winner && p.recommendation !== 'avoid' && p.recommendation !== 'no_edge')
        .map(pred => {
          const isHomePick = pred.predicted_winner === pred.home_team;
          return {
            user_id: user.id,
            date: pred.game_date,
            state: userState,
            platform: platformKey,
            sport: 'NBA',
            format_tag: 'sportsbook_prop',
            market: 'Moneyline',
            team: pred.predicted_winner,
            opponent: isHomePick ? pred.away_team : pred.home_team,
            side: isHomePick ? 'HOME' : 'AWAY',
            stake: 0,
            odds: null,
            multiplier: null,
            status: 'open',
            result: null,
            profit_loss: 0,
            notes: `AI Confidence: ${pred.confidence_score?.toFixed(0)}% | ${pred.recommendation} | ${pred.reasoning || ''}`,
            decision_source: 'AI',
          };
        });
      
      if (entries.length === 0) {
        return { count: 0, message: 'No valid predictions to save (all marked as avoid/no_edge)' };
      }
      
      // Check for existing entries to avoid duplicates
      const { data: existing, error: fetchError } = await supabase
        .from('pick_entries')
        .select('team, opponent, date')
        .eq('user_id', user.id)
        .eq('market', 'Moneyline')
        .eq('date', preds[0]?.game_date);
      
      if (fetchError) {
        console.error('Error checking existing entries:', fetchError);
        throw new Error(`Failed to check existing entries: ${fetchError.message}`);
      }
      
      const existingSet = new Set(
        existing?.map(e => `${e.team}-${e.opponent}-${e.date}`) || []
      );
      
      const newEntries = entries.filter(e => 
        !existingSet.has(`${e.team}-${e.opponent}-${e.date}`)
      );
      
      if (newEntries.length === 0) {
        return { count: 0, alreadySaved: true };
      }
      
      // Log payload for debugging
      console.log('Inserting moneyline entries:', JSON.stringify(newEntries, null, 2));
      
      const { data: insertedData, error } = await supabase
        .from('pick_entries')
        .insert(newEntries)
        .select();
      
      if (error) {
        console.error('Supabase insert error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payload: newEntries
        });
        throw new Error(`Database error: ${error.message}${error.hint ? ` (Hint: ${error.hint})` : ''}`);
      }
      
      console.log('Successfully inserted:', insertedData);
      return { count: newEntries.length };
    },
    onSuccess: (data) => {
      if (data.alreadySaved) {
        toast.info('Moneyline leans already saved for this date');
      } else if (data.message) {
        toast.info(data.message);
      } else if (data.count > 0) {
        toast.success(`Saved ${data.count} moneyline lean${data.count !== 1 ? 's' : ''} to entries`);
      }
      queryClient.invalidateQueries({ queryKey: ['moneyline-entries'] });
    },
    onError: (error: Error) => {
      console.error('Error persisting predictions:', error);
      toast.error(error.message || 'Failed to save moneyline leans');
    }
  });

  const generatePredictions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('nba-moneyline-engine');
      
      if (error) throw error;
      
      toast.success(`Generated ${data.predictions} moneyline predictions`);
      refetchPredictions();
    } catch (err) {
      console.error('Error generating predictions:', err);
      toast.error('Failed to generate predictions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePredictions = () => {
    if (predictions && predictions.length > 0) {
      persistPredictions.mutate(predictions);
    }
  };

  // Filter by recommendation for summary
  const strongLeans = predictions?.filter(p => p.recommendation === 'strong_lean') || [];
  const leans = predictions?.filter(p => p.recommendation === 'lean') || [];
  const slightLeans = predictions?.filter(p => p.recommendation === 'slight_lean') || [];

  const isLoading = predictionsLoading || entriesLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              NBA Moneyline Leans
            </CardTitle>
            <CardDescription className="mt-1">
              Team-level predictions (separate from player props)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Picker */}
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
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {isToday && (
              <>
                <Button
                  onClick={generatePredictions}
                  disabled={isGenerating}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
                <Button
                  onClick={handleSavePredictions}
                  disabled={persistPredictions.isPending || !predictions?.length}
                  size="sm"
                >
                  <Save className={`w-4 h-4 mr-2 ${persistPredictions.isPending ? 'animate-pulse' : ''}`} />
                  {persistPredictions.isPending ? 'Saving...' : 'Save to Entries'}
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Summary badges */}
        {predictions && predictions.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {strongLeans.length > 0 && (
              <Badge className="bg-green-500/20 text-green-400">
                {strongLeans.length} Strong Lean{strongLeans.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {leans.length > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400">
                {leans.length} Lean{leans.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {slightLeans.length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                {slightLeans.length} Slight
              </Badge>
            )}
            <span className="text-sm text-muted-foreground ml-2">
              {predictions.length} of {validationStatus.expectedCount ?? '?'} games
            </span>
            {validationStatus.mismatch && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Count Mismatch
              </Badge>
            )}
          </div>
        )}
        
        {/* Date indicator and Settlement status */}
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">
            Showing games for: {selectedDateStr} (Eastern Time)
          </span>
          
          {/* Auto-Settlement Indicator */}
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Zap className={`w-3 h-3 ${isSettling ? 'text-yellow-400 animate-pulse' : 'text-green-400'}`} />
                    <span>Auto-settle</span>
                    {lastSettlementRun && (
                      <span className="text-muted-foreground/70">
                        ({format(lastSettlementRun, 'h:mm a')})
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Auto-settlement runs every 15 minutes</p>
                  <p className="text-xs text-muted-foreground">
                    {finalGamesCount} final games | {openEntriesCount} open entries
                  </p>
                </TooltipContent>
              </Tooltip>
              
              {isAdmin() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runSettlement}
                  disabled={isSettling}
                  className="h-6 px-2 text-xs"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isSettling ? 'animate-spin' : ''}`} />
                  {isSettling ? 'Settling...' : 'Run Now'}
                </Button>
              )}
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Tabs for Open/Settled/Confirm */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'open' | 'settlement' | 'settled' | 'results')} className="mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="open" className="gap-2">
              <Clock className="w-4 h-4" />
              Today ({openEntries.length})
            </TabsTrigger>
            <TabsTrigger value="settlement" className="gap-2">
              <Zap className="w-4 h-4" />
              Settlement ({allOpenEntries.length})
            </TabsTrigger>
            <TabsTrigger value="settled" className="gap-2">
              <Trophy className="w-4 h-4" />
              Settled ({settledEntries.length})
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Final Results
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'open' ? (
          // Open Tab - Show predictions with save status
          !predictions || predictions.length === 0 ? (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No Moneyline entries recorded for {selectedDateStr}</p>
              {isToday && (
                <p className="text-sm text-muted-foreground mt-1">Click "Generate" to analyze today's games</p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {predictions.map((prediction) => (
                  <MoneylineCard
                    key={prediction.id}
                    prediction={prediction}
                    expanded={expandedId === prediction.id}
                    onToggle={() => setExpandedId(expandedId === prediction.id ? null : prediction.id)}
                    showTimeDebug={showTimeDebug}
                    isPersisted={!!predictionToEntryMap[prediction.id]}
                  />
                ))}
              </div>
            </ScrollArea>
          )
        ) : activeTab === 'settlement' ? (
          // Settlement Tab - Show ALL open entries (date-agnostic) for settlement
          allOpenEntries.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No unsettled games available for settlement.</p>
              <p className="text-sm text-muted-foreground mt-1">All entries have been settled or no open entries exist.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {/* Group entries by date */}
                {Object.entries(
                  allOpenEntries.reduce((acc, entry) => {
                    const date = entry.date;
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(entry);
                    return acc;
                  }, {} as Record<string, typeof allOpenEntries>)
                ).sort(([a], [b]) => b.localeCompare(a)).map(([date, entries]) => {
                  // Find matching final games for this date
                  const gamesForDate = finalGames.filter(g => g.game_date === date);
                  
                  return (
                    <div key={date} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">{format(new Date(date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}</h4>
                        <Badge variant="outline" className="text-xs">
                          {entries.length} open • {gamesForDate.length} final
                        </Badge>
                      </div>
                      {entries.map((entry) => {
                        // Find matching final game
                        const matchedGame = gamesForDate.find(game => {
                          const entryTeam = entry.team?.toUpperCase();
                          const entryOpponent = entry.opponent?.toUpperCase();
                          const gameHome = game.home_team?.toUpperCase();
                          const gameAway = game.away_team?.toUpperCase();
                          return (entryTeam === gameHome && entryOpponent === gameAway) ||
                                 (entryTeam === gameAway && entryOpponent === gameHome);
                        });
                        const isFinal = matchedGame && matchedGame.winner;
                        
                        return (
                          <Card key={entry.id} className={`border-l-4 ${isFinal ? 'border-l-green-500' : 'border-l-yellow-500'}`}>
                            <CardContent className="pt-4 pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-medium text-primary">{entry.team}</span>
                                    <span className="text-muted-foreground">vs</span>
                                    <span className="font-medium">{entry.opponent}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {entry.side}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge className={isFinal ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'}>
                                      {isFinal ? 'Final' : 'In Progress / Pending'}
                                    </Badge>
                                    {matchedGame && matchedGame.home_score !== null && (
                                      <span className="text-sm text-muted-foreground">
                                        {matchedGame.away_team} {matchedGame.away_score} - {matchedGame.home_score} {matchedGame.home_team}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isFinal && matchedGame?.winner && (
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge className={entry.team?.toUpperCase() === matchedGame.winner?.toUpperCase() 
                                      ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                                      : 'bg-red-500/20 text-red-400 border-red-500/50'
                                    }>
                                      {entry.team?.toUpperCase() === matchedGame.winner?.toUpperCase() ? 'WIN' : 'LOSS'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Winner: {matchedGame.winner}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )
        ) : activeTab === 'settled' ? (
          // Settled Tab - Show settled entries
          settledEntries.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No settled Moneyline entries for {selectedDateStr}</p>
              <p className="text-sm text-muted-foreground mt-1">Settle open entries to track results</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {settledEntries.map((entry) => (
                  <SettledEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </ScrollArea>
          )
        ) : (
          // Final Results Tab - Read-only settled results
          <SettledResults />
        )}
        
        {/* Disclaimer */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Moneyline Model Disclaimer</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Separate model from player props - do not combine confidence scores</li>
                <li>Maximum probability capped at 70% (conservative approach)</li>
                <li>Based on team-level statistics: net rating, pace, rest, B2B status</li>
                <li>Results are automatically settled from final game scores</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NBAMoneylineLeans;
