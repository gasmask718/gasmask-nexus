import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  Check, 
  X, 
  Edit2, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare,
  ArrowRight,
  Copy,
  Clock
} from "lucide-react";
import { AISuggestion } from "@/hooks/useAssistedModeSuggestions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LiveSuggestionPanelProps {
  suggestion: AISuggestion | null;
  isGenerating: boolean;
  onUseSuggestion: (predictionId: string) => void;
  onDismiss: (predictionId: string, reason?: string) => void;
  onModify: (predictionId: string) => void;
  suggestionHistory: AISuggestion[];
}

export function LiveSuggestionPanel({
  suggestion,
  isGenerating,
  onUseSuggestion,
  onDismiss,
  onModify,
  suggestionHistory,
}: LiveSuggestionPanelProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-500";
    if (confidence >= 60) return "text-yellow-500";
    return "text-destructive";
  };

  const getIntentBadgeVariant = (intent: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (intent.toLowerCase()) {
      case 'complaint':
        return 'destructive';
      case 'sales inquiry':
        return 'default';
      case 'support request':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!suggestion && !isGenerating) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            AI suggestions will appear here as the conversation progresses
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Suggestion */}
      <Card className={cn(
        "border-2 transition-all",
        isGenerating ? "border-primary/50 animate-pulse" : "border-primary"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              AI Suggestion
            </CardTitle>
            {isGenerating ? (
              <Badge variant="outline" className="animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                Analyzing...
              </Badge>
            ) : suggestion && (
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-medium", getConfidenceColor(suggestion.confidence))}>
                  {suggestion.confidence}%
                </span>
                <Progress 
                  value={suggestion.confidence} 
                  className="w-16 h-2"
                />
              </div>
            )}
          </div>
        </CardHeader>

        {suggestion && (
          <CardContent className="space-y-4">
            {/* Intent & Risk Flags */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getIntentBadgeVariant(suggestion.intent)}>
                {suggestion.intent}
              </Badge>
              {suggestion.risk_flags.map((flag) => (
                <Badge key={flag} variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {flag.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>

            {/* Suggested Response */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Suggested Response
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(suggestion.suggested_response)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm">{suggestion.suggested_response}</p>
              </div>
            </div>

            {/* Next Question */}
            {suggestion.suggested_next_question && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Follow-up Question
                </span>
                <div className="p-2 rounded bg-muted/50 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{suggestion.suggested_next_question}</p>
                </div>
              </div>
            )}

            {/* Recommended Route */}
            {suggestion.recommended_route && (
              <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <ArrowRight className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">
                  Consider routing to: <strong>{suggestion.recommended_route}</strong>
                </span>
              </div>
            )}

            {/* Reasoning */}
            <div className="text-xs text-muted-foreground italic border-t pt-2">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              {suggestion.reasoning}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => suggestion.prediction_id && onUseSuggestion(suggestion.prediction_id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Use
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => suggestion.prediction_id && onModify(suggestion.prediction_id)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Modify
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => suggestion.prediction_id && onDismiss(suggestion.prediction_id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Suggestion History */}
      {suggestionHistory.length > 1 && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-xs text-muted-foreground">Previous Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {suggestionHistory.slice(1).map((hist, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 rounded bg-muted/50 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {hist.intent}
                      </Badge>
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {hist.suggested_response}
                      </span>
                    </div>
                    <span className={cn("text-xs", getConfidenceColor(hist.confidence))}>
                      {hist.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
