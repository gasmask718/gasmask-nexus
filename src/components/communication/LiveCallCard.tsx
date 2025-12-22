import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, PhoneOff, UserCheck, Bot, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LiveCallSession } from "@/hooks/useLiveCallSessions";
import { formatDistanceToNow } from "date-fns";

interface LiveCallCardProps {
  session: LiveCallSession;
  onTakeOver: (sessionId: string) => void;
  onReturnToAI: (sessionId: string) => void;
  onEndCall: (sessionId: string) => void;
  isTakingOver?: boolean;
  isReturning?: boolean;
  isEnding?: boolean;
}

export function LiveCallCard({
  session,
  onTakeOver,
  onReturnToAI,
  onEndCall,
  isTakingOver,
  isReturning,
  isEnding,
}: LiveCallCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ai_active": return "bg-primary text-primary-foreground";
      case "human_active": return "bg-green-500 text-white";
      case "ringing": return "bg-yellow-500 text-white";
      case "on_hold": return "bg-orange-500 text-white";
      case "initiated": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getHandoffBadge = (state: string) => {
    switch (state) {
      case "pending_to_human":
        return <Badge variant="destructive" className="animate-pulse">Handoff Requested</Badge>;
      case "human_active":
        return <Badge className="bg-green-500">Human Active</Badge>;
      case "back_to_ai":
        return <Badge variant="secondary">Returning to AI</Badge>;
      default:
        return null;
    }
  };

  const getSentimentIcon = (trend: string | null) => {
    switch (trend) {
      case "positive": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "negative": return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const elapsedTime = formatDistanceToNow(new Date(session.created_at), { addSuffix: false });

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(session.status)}>
              {session.status === "ai_active" ? (
                <><Bot className="h-3 w-3 mr-1" /> AI Active</>
              ) : session.status === "human_active" ? (
                <><UserCheck className="h-3 w-3 mr-1" /> Human Active</>
              ) : (
                session.status.replace("_", " ")
              )}
            </Badge>
            {getHandoffBadge(session.handoff_state)}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            {elapsedTime}
          </div>
        </div>
        <CardTitle className="text-lg mt-2">
          {session.store?.store_name || "Unknown Store"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {session.business?.name || "No Business"} • {session.persona?.name || "Default Persona"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment & Tone */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Sentiment:</span>
            {getSentimentIcon(session.sentiment_trend)}
            <span className="text-sm capitalize">{session.sentiment_trend || "neutral"}</span>
          </div>
          {session.persona?.tone && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Tone:</span>
              <Badge variant="outline" className="text-xs">{session.persona.tone}</Badge>
            </div>
          )}
        </div>

        {/* Live Transcript Preview */}
        {session.transcript && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Live Transcript</span>
            <ScrollArea className="h-24 rounded border bg-muted/50 p-2">
              <p className="text-sm whitespace-pre-wrap">{session.transcript}</p>
            </ScrollArea>
          </div>
        )}

        {/* AI Notes */}
        {session.ai_notes && (
          <div className="p-2 rounded bg-primary/10 border border-primary/20">
            <span className="text-xs font-medium text-primary">AI Notes:</span>
            <p className="text-sm mt-1">{session.ai_notes}</p>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2 pt-2">
          {session.status === "ai_active" || session.handoff_state === "pending_to_human" ? (
            <Button
              onClick={() => onTakeOver(session.id)}
              disabled={isTakingOver}
              className="flex-1"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Take Over Call
            </Button>
          ) : session.status === "human_active" ? (
            <Button
              onClick={() => onReturnToAI(session.id)}
              disabled={isReturning}
              variant="secondary"
              className="flex-1"
            >
              <Bot className="h-4 w-4 mr-2" />
              Return to AI
            </Button>
          ) : null}
          <Button
            onClick={() => onEndCall(session.id)}
            disabled={isEnding}
            variant="destructive"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
