import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, 
  Home, Plane, AlertTriangle, CheckCircle, XCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';

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

const MoneylineCard = ({ prediction, expanded, onToggle }: { 
  prediction: MoneylinePrediction; 
  expanded: boolean;
  onToggle: () => void;
}) => {
  const homeProb = prediction.home_win_probability ? (prediction.home_win_probability * 100).toFixed(1) : 'N/A';
  const awayProb = prediction.away_win_probability ? (prediction.away_win_probability * 100).toFixed(1) : 'N/A';
  const isHomeFavored = (prediction.home_win_probability || 0) >= (prediction.away_win_probability || 0);
  
  const gameTime = prediction.game_time 
    ? new Date(prediction.game_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

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
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{gameTime}</span>
                  {getRecommendationBadge(prediction.recommendation)}
                  {prediction.confidence_score && (
                    <Badge variant="outline" className="text-xs">
                      {prediction.confidence_score.toFixed(0)}% conf
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
            
            {/* Reasoning */}
            {prediction.reasoning && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">{prediction.reasoning}</p>
                </div>
              </div>
            )}
            
            {/* Prediction Summary */}
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
            
            {/* Guardrail Notice */}
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

const NBAMoneylineLeans = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data: predictions, isLoading, refetch } = useQuery({
    queryKey: ['nba-moneyline-predictions', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_moneyline_predictions')
        .select('*')
        .eq('game_date', today)
        .order('game_time', { ascending: true });
      
      if (error) throw error;
      return data as MoneylinePrediction[];
    }
  });

  const generatePredictions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('nba-moneyline-engine');
      
      if (error) throw error;
      
      toast.success(`Generated ${data.predictions} moneyline predictions`);
      refetch();
    } catch (err) {
      console.error('Error generating predictions:', err);
      toast.error('Failed to generate predictions');
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter by recommendation for summary
  const strongLeans = predictions?.filter(p => p.recommendation === 'strong_lean') || [];
  const leans = predictions?.filter(p => p.recommendation === 'lean') || [];
  const slightLeans = predictions?.filter(p => p.recommendation === 'slight_lean') || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              NBA Moneyline Leans
            </CardTitle>
            <CardDescription className="mt-1">
              Team-level predictions (separate from player props)
            </CardDescription>
          </div>
          <Button
            onClick={generatePredictions}
            disabled={isGenerating}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate Predictions'}
          </Button>
        </div>
        
        {/* Summary badges */}
        {predictions && predictions.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
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
              {predictions.length} total games
            </span>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !predictions || predictions.length === 0 ? (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No moneyline predictions for today</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Generate Predictions" to analyze today's games</p>
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
                />
              ))}
            </div>
          </ScrollArea>
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
                <li>Does not account for all injury scenarios</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NBAMoneylineLeans;
