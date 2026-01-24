import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bot,
  User,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DecisionExplainerProps {
  sessionId?: string;
  decisionId?: string;
  className?: string;
}

interface Decision {
  id: string;
  created_at: string;
  decision_type: string;
  decision_reason: string;
  risk_level: string | null;
  confidence_at_decision: number | null;
  caller_sentiment: string | null;
  rule_applied: string | null;
  active_thresholds: Record<string, unknown> | null;
  transcript_snapshot: string | null;
}

export function DecisionExplainer({
  sessionId,
  decisionId,
  className,
}: DecisionExplainerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const { data: decisions, isLoading } = useQuery({
    queryKey: ["decision-explainer", sessionId, decisionId],
    queryFn: async () => {
      let query = supabase
        .from("ai_call_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (decisionId) {
        query = query.eq("id", decisionId);
      } else if (sessionId) {
        query = query.eq("session_id", sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Decision[];
    },
    enabled: !!(sessionId || decisionId),
  });

  const generateExplanation = (decision: Decision): string => {
    const type = decision.decision_type;
    const reason = decision.decision_reason;
    const risk = decision.risk_level;
    const confidence = decision.confidence_at_decision;
    const rule = decision.rule_applied;
    const thresholds = decision.active_thresholds;

    let explanation = `AI ${
      type === "continue"
        ? "continued answering"
        : type === "handoff"
        ? "handed off to human"
        : type === "abort"
        ? "immediately stopped speaking"
        : type === "escalate"
        ? "escalated to human"
        : type === "confidence_breach"
        ? "aborted due to low confidence"
        : type === "blocked"
        ? "was blocked from answering"
        : "made a decision"
    } because: ${reason}.`;

    if (risk) {
      explanation += ` Risk level was assessed as ${risk}.`;
    }

    if (confidence !== null) {
      explanation += ` AI confidence at decision time was ${confidence}%.`;
    }

    if (rule) {
      explanation += ` The governing rule that triggered this action was: ${rule}.`;
    }

    if (thresholds && Object.keys(thresholds).length > 0) {
      const thresholdList = Object.entries(thresholds)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("; ");
      explanation += ` Active thresholds: ${thresholdList}.`;
    }

    return explanation;
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case "continue":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "handoff":
      case "escalate":
        return <User className="h-4 w-4 text-amber-500" />;
      case "abort":
      case "confidence_breach":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "blocked":
        return <Shield className="h-4 w-4 text-destructive" />;
      default:
        return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRiskBadge = (risk: string | null) => {
    if (!risk) return null;
    const variants: Record<string, string> = {
      low: "bg-green-100 text-green-800",
      medium: "bg-amber-100 text-amber-800",
      high: "bg-red-100 text-red-800",
      critical: "bg-red-600 text-white",
    };
    return (
      <Badge className={variants[risk] || "bg-muted"}>
        {risk} risk
      </Badge>
    );
  };

  if (!sessionId && !decisionId) {
    return null;
  }

  const latestDecision = decisions?.[0];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  Why This Happened
                </CardTitle>
                {latestDecision && (
                  <Badge variant="outline" className="text-xs">
                    {latestDecision.decision_type}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading decision history...</p>
            ) : !decisions || decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decision records found.</p>
            ) : (
              <ScrollArea className="max-h-64">
                <div className="space-y-4">
                  {decisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="p-3 rounded-lg bg-muted/50 border space-y-2"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getDecisionIcon(decision.decision_type)}
                          <span className="font-medium capitalize">
                            {decision.decision_type.replace("_", " ")}
                          </span>
                          {getRiskBadge(decision.risk_level)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(decision.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>

                      {/* Plain English Explanation */}
                      <p className="text-sm text-foreground leading-relaxed">
                        {generateExplanation(decision)}
                      </p>

                      {/* Confidence & Sentiment */}
                      {(decision.confidence_at_decision !== null ||
                        decision.caller_sentiment) && (
                        <div className="flex items-center gap-4 text-xs">
                          {decision.confidence_at_decision !== null && (
                            <span className="text-muted-foreground">
                              Confidence:{" "}
                              <strong
                                className={
                                  decision.confidence_at_decision >= 70
                                    ? "text-green-600"
                                    : "text-destructive"
                                }
                              >
                                {decision.confidence_at_decision}%
                              </strong>
                            </span>
                          )}
                          {decision.caller_sentiment && (
                            <span className="text-muted-foreground">
                              Sentiment:{" "}
                              <strong className="capitalize">
                                {decision.caller_sentiment}
                              </strong>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rule Applied */}
                      {decision.rule_applied && (
                        <div className="text-xs text-muted-foreground">
                          <Shield className="h-3 w-3 inline mr-1" />
                          Governing rule: <code className="bg-muted px-1 rounded">{decision.rule_applied}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Audit Trail Link */}
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                This explanation is sourced directly from the immutable audit log.
                Suitable for legal review, carrier audit, and regulatory inquiry.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default DecisionExplainer;
