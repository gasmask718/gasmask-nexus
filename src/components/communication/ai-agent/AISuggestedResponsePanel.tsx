import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Brain
} from "lucide-react";
import { AIPrediction, useEvaluatePrediction } from "@/hooks/useAICallAgent";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AISuggestedResponsePanelProps {
  predictions: AIPrediction[];
  isLoading?: boolean;
}

export function AISuggestedResponsePanel({ predictions, isLoading }: AISuggestedResponsePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const evaluateMutation = useEvaluatePrediction();
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleEvaluate = (predictionId: string, wasAccurate: boolean, humanOverrode?: boolean) => {
    evaluateMutation.mutate({
      predictionId,
      wasAccurate,
      humanOverrode,
      overrideReason: humanOverrode ? overrideReason : undefined,
    });
    setExpandedId(null);
    setOverrideReason("");
  };

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-amber-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-destructive';
  };

  const getIntentBadge = (intent: string | null) => {
    if (!intent) return null;
    const intentLower = intent.toLowerCase();
    
    if (intentLower.includes('sales') || intentLower.includes('inquiry')) {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Sales</Badge>;
    }
    if (intentLower.includes('support') || intentLower.includes('help')) {
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600">Support</Badge>;
    }
    if (intentLower.includes('complaint')) {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive">Complaint</Badge>;
    }
    if (intentLower.includes('follow')) {
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600">Follow-up</Badge>;
    }
    return <Badge variant="outline">{intent.slice(0, 20)}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading predictions...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
            <Brain className="h-12 w-12 mb-2 opacity-50" />
            <p>No AI predictions yet</p>
            <p className="text-sm">Predictions will appear as calls come in</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Suggestions
          <Badge variant="secondary" className="ml-auto">
            {predictions.length} recent
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {predictions.map((prediction) => (
              <div 
                key={prediction.id} 
                className={cn(
                  "p-4 transition-colors",
                  expandedId === prediction.id ? "bg-muted/50" : "hover:bg-muted/30"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {prediction.caller_phone || 'Unknown Caller'}
                    </span>
                    {getIntentBadge(prediction.predicted_intent)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", getConfidenceColor(prediction.confidence_score))}>
                      {prediction.confidence_score || 0}%
                    </span>
                    {prediction.was_accurate === true && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {prediction.was_accurate === false && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Suggested Response */}
                <div className="bg-background rounded-lg p-3 mb-2 border">
                  <p className="text-sm italic">"{prediction.drafted_response}"</p>
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(prediction.created_at), { addSuffix: true })}
                  </span>
                  {prediction.predicted_route && (
                    <span>Route: {prediction.predicted_route}</span>
                  )}
                  {prediction.processing_time_ms && (
                    <span>{prediction.processing_time_ms}ms</span>
                  )}
                </div>

                {/* Actions */}
                {prediction.was_accurate === null && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => handleEvaluate(prediction.id, true)}
                        disabled={evaluateMutation.isPending}
                      >
                        <ThumbsUp className="h-3 w-3" />
                        Accurate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => setExpandedId(expandedId === prediction.id ? null : prediction.id)}
                      >
                        <ThumbsDown className="h-3 w-3" />
                        Inaccurate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(prediction.drafted_response || '')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Override Reason Input */}
                    {expandedId === prediction.id && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Why was this suggestion inaccurate? (optional)"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleEvaluate(prediction.id, false, true)}
                            disabled={evaluateMutation.isPending}
                          >
                            Submit Feedback
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setExpandedId(null);
                              setOverrideReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Already Evaluated */}
                {prediction.was_accurate !== null && prediction.human_overrode && (
                  <p className="text-xs text-muted-foreground italic">
                    Override reason: {prediction.override_reason || 'Not specified'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
