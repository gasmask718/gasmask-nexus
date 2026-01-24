import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  PhoneOff,
  Shield,
  Zap
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface CanaryCallCardProps {
  canaryLog: {
    id: string;
    session_id: string | null;
    entry_confidence: number;
    entry_trust_score: number;
    call_risk_level: 'low' | 'medium' | 'high';
    call_type: string | null;
    initial_sentiment: string | null;
    created_at: string;
    session?: {
      id: string;
      status: string;
      transcript: string | null;
      sentiment_trend: string | null;
      store?: { id: string; store_name: string } | null;
      persona?: { id: string; name: string; tone: string } | null;
    } | null;
  };
  onTakeOver: (sessionId: string) => void;
  onEndCall: (sessionId: string) => void;
  isTakingOver?: boolean;
  isEnding?: boolean;
}

export function CanaryCallCard({
  canaryLog,
  onTakeOver,
  onEndCall,
  isTakingOver,
  isEnding,
}: CanaryCallCardProps) {
  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-500';
    if (confidence >= 80) return 'text-amber-500';
    return 'text-destructive';
  };

  const elapsedTime = formatDistanceToNow(new Date(canaryLog.created_at), { addSuffix: false });
  const session = canaryLog.session;

  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 text-white">
              <Bot className="h-3 w-3 mr-1" />
              AI Canary
            </Badge>
            <Badge variant="outline" className={getRiskColor(canaryLog.call_risk_level)}>
              {canaryLog.call_risk_level} risk
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            {elapsedTime}
          </div>
        </div>
        <CardTitle className="text-lg mt-2 flex items-center gap-2">
          {session?.store?.store_name || "Unknown Caller"}
          <Shield className="h-4 w-4 text-amber-500" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {session?.persona?.name || "Default Persona"} • {canaryLog.call_type || "General"}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Confidence & Trust Meters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span className={cn("font-medium", getConfidenceColor(canaryLog.entry_confidence))}>
                {canaryLog.entry_confidence}%
              </span>
            </div>
            <Progress value={canaryLog.entry_confidence} className="h-2" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trust Score</span>
              <span className="font-medium">{canaryLog.entry_trust_score}%</span>
            </div>
            <Progress value={canaryLog.entry_trust_score} className="h-2" />
          </div>
        </div>

        {/* Sentiment Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Sentiment:</span>
            {getSentimentIcon(session?.sentiment_trend || canaryLog.initial_sentiment)}
            <span className="text-sm capitalize">
              {session?.sentiment_trend || canaryLog.initial_sentiment || 'neutral'}
            </span>
          </div>
          {session?.persona?.tone && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Tone:</span>
              <Badge variant="outline" className="text-xs">{session.persona.tone}</Badge>
            </div>
          )}
        </div>

        {/* Live Transcript */}
        {session?.transcript && (
          <div className="space-y-1">
            <span className="text-sm font-medium flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              Live AI Conversation
            </span>
            <ScrollArea className="h-32 rounded border bg-muted/50 p-2">
              <p className="text-sm whitespace-pre-wrap font-mono">{session.transcript}</p>
            </ScrollArea>
          </div>
        )}

        {/* Warning Banner */}
        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>AI is speaking to caller. Take over instantly if needed.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => session?.id && onTakeOver(session.id)}
            disabled={isTakingOver || !session?.id}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Take Over Now
          </Button>
          <Button
            onClick={() => session?.id && onEndCall(session.id)}
            disabled={isEnding || !session?.id}
            variant="destructive"
            size="lg"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
