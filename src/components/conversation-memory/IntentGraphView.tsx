import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles,
  Lock, Unlock, Check, X, MessageSquare, ChevronDown, ChevronUp,
  Target, Zap, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useIntentGraph,
  useIntentNodes,
  useExtractIntents,
  useUpdateIntentNode,
  useAddIntentFeedback,
  IntentNode,
} from "@/hooks/useIntentGraph";

interface IntentGraphViewProps {
  conversationId: string;
}

const intentTypeColors: Record<string, string> = {
  Purchase: "bg-green-500/10 text-green-600 border-green-500/20",
  Support: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Complaint: "bg-red-500/10 text-red-600 border-red-500/20",
  Negotiation: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Partnership: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Curiosity: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  Churn_Risk: "bg-red-600/10 text-red-700 border-red-600/20",
  Legal: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  Payment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Trust_Building: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  Reorder: "bg-green-600/10 text-green-700 border-green-600/20",
  Upsell_Opportunity: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Referral: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  Feedback: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export function IntentGraphView({ conversationId }: IntentGraphViewProps) {
  const { data: graph, isLoading: graphLoading } = useIntentGraph(conversationId);
  const { data: intents = [], isLoading: intentsLoading } = useIntentNodes(graph?.id || null);
  const extractIntents = useExtractIntents();

  const activeIntents = intents.filter(i => i.status === 'active');
  const otherIntents = intents.filter(i => i.status !== 'active');

  if (graphLoading) {
    return <div className="p-4 text-muted-foreground">Loading intent graph...</div>;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Intent Graph v2
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => extractIntents.mutate(conversationId)}
            disabled={extractIntents.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", extractIntents.isPending && "animate-spin")} />
            Analyze
          </Button>
        </div>

        {/* Risk & Opportunity Indices */}
        {graph && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-3 w-3" /> Risk
                </span>
                <span>{Math.round((graph.risk_index || 0) * 100)}%</span>
              </div>
              <Progress 
                value={(graph.risk_index || 0) * 100} 
                className="h-2"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <Sparkles className="h-3 w-3" /> Opportunity
                </span>
                <span>{Math.round((graph.opportunity_index || 0) * 100)}%</span>
              </div>
              <Progress 
                value={(graph.opportunity_index || 0) * 100} 
                className="h-2"
              />
            </div>
          </div>
        )}

        {/* Velocity Score */}
        {graph && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Velocity:</span>
            <Badge variant="outline" className={cn(
              graph.intent_velocity_score > 0 && "text-green-600",
              graph.intent_velocity_score < 0 && "text-red-600"
            )}>
              {graph.intent_velocity_score > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : 
               graph.intent_velocity_score < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
              {graph.intent_velocity_score.toFixed(1)}
            </Badge>
            <span className="text-muted-foreground ml-auto text-xs">
              Last analyzed: {graph.last_analyzed_at ? format(new Date(graph.last_analyzed_at), 'MMM d, h:mm a') : 'Never'}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {intents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No intents detected yet</p>
              <p className="text-xs mt-1">Click "Analyze" to extract intents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Intents */}
              {activeIntents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Zap className="h-4 w-4 text-amber-500" /> Active Intents
                  </h4>
                  <div className="space-y-2">
                    {activeIntents.map((intent) => (
                      <IntentNodeCard key={intent.id} intent={intent} />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Intents */}
              {otherIntents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                    Other Intents ({otherIntents.length})
                  </h4>
                  <div className="space-y-2">
                    {otherIntents.map((intent) => (
                      <IntentNodeCard key={intent.id} intent={intent} compact />
                    ))}
                  </div>
                </div>
              )}

              {/* Predictions */}
              {graph?.predictions && graph.predictions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Target className="h-4 w-4 text-blue-500" /> Predictions
                  </h4>
                  <div className="space-y-2">
                    {graph.predictions.map((pred: any, i: number) => (
                      <div key={i} className="text-sm p-2 bg-blue-500/5 rounded border border-blue-500/20">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{pred.prediction_type}</span>
                          <Badge variant="outline">{Math.round((pred.confidence || 0) * 100)}%</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs mt-1">{pred.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {graph?.suggestions && graph.suggestions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-purple-500" /> Suggested Actions
                  </h4>
                  <div className="space-y-2">
                    {graph.suggestions.map((sug: any, i: number) => (
                      <div key={i} className="text-sm p-2 bg-purple-500/5 rounded border border-purple-500/20">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{sug.action}</span>
                          <Badge variant="outline">{Math.round((sug.confidence || 0) * 100)}%</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs mt-1">{sug.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function IntentNodeCard({ intent, compact = false }: { intent: IntentNode; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const updateIntent = useUpdateIntentNode();
  const addFeedback = useAddIntentFeedback();

  const colorClass = intentTypeColors[intent.intent_type] || "bg-gray-500/10 text-gray-600 border-gray-500/20";

  const handleApprove = () => {
    addFeedback.mutate({
      intent_node_id: intent.id,
      feedback_type: 'approve',
    });
  };

  const handleReject = () => {
    addFeedback.mutate({
      intent_node_id: intent.id,
      feedback_type: 'reject',
    });
    updateIntent.mutate({
      id: intent.id,
      updates: { status: 'dormant' },
    });
  };

  const handleLock = () => {
    updateIntent.mutate({
      id: intent.id,
      updates: { is_locked: !intent.is_locked },
    });
  };

  return (
    <div className={cn("border rounded-lg p-3", colorClass)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={colorClass}>
            {intent.intent_type.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className={cn(
            "text-xs",
            intent.intent_direction === 'positive' && "bg-green-500/10 text-green-600",
            intent.intent_direction === 'negative' && "bg-red-500/10 text-red-600"
          )}>
            {intent.intent_direction}
          </Badge>
          {intent.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          {!compact && (
            <>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleApprove}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleReject}>
                <X className="h-3 w-3 text-red-600" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleLock}>
                {intent.is_locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Strength Bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Strength: {intent.intent_strength}%</span>
          <span>Urgency: {intent.urgency_score}%</span>
        </div>
        <Progress value={intent.intent_strength} className="h-1.5" />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Emotional:</span>
            <Badge variant="secondary" className="text-xs">{intent.emotional_charge}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Conversion:</span>
            <span>{Math.round((intent.likelihood_to_convert || 0) * 100)}%</span>
          </div>
          {intent.blockers?.length > 0 && (
            <div>
              <span className="text-muted-foreground">Blockers:</span>
              <div className="flex gap-1 flex-wrap mt-1">
                {intent.blockers.map((b, i) => (
                  <Badge key={i} variant="destructive" className="text-xs">{b}</Badge>
                ))}
              </div>
            </div>
          )}
          {intent.ai_reasoning && (
            <div className="p-2 bg-background/50 rounded text-xs">
              <span className="text-muted-foreground">AI Reasoning:</span>
              <p className="mt-1">{intent.ai_reasoning}</p>
            </div>
          )}
          {intent.human_override_note && (
            <div className="p-2 bg-amber-500/10 rounded text-xs">
              <span className="text-amber-600">Human Note:</span>
              <p className="mt-1">{intent.human_override_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
