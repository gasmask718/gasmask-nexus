import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Brain,
  Phone,
  MessageSquare,
  Clock,
  ArrowRight,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  TrendingUp,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useBusinessStore } from "@/stores/businessStore";
import { Link } from "react-router-dom";

interface AISuggestion {
  id: string;
  type: "callback" | "sms" | "routing" | "escalation";
  title: string;
  description: string;
  priority: "normal" | "high" | "critical";
  entity_type: string;
  entity_id: string;
  suggested_action: string;
  confidence: number;
  created_at: string;
}

export default function AIActionsPanel() {
  const { selectedBusiness } = useBusinessStore();

  // Fetch voicemails needing AI analysis
  const { data: pendingAnalysis } = useQuery({
    queryKey: ["voicemails-pending-analysis", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voicemails")
        .select("id, caller_number, caller_name, transcription, created_at")
        .eq("business_id", selectedBusiness?.id)
        .is("ai_analyzed_at", null)
        .not("transcription", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Fetch intelligence signals for suggestions
  const { data: signals } = useQuery({
    queryKey: ["ai-suggestions-signals", selectedBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_intelligence_signals")
        .select("*")
        .eq("business_id", selectedBusiness?.id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedBusiness?.id,
  });

  // Analyze all pending voicemails
  const analyzeAllMutation = useMutation({
    mutationFn: async () => {
      if (!pendingAnalysis?.length) return { analyzed: 0 };
      
      let analyzed = 0;
      for (const vm of pendingAnalysis.slice(0, 5)) { // Limit to 5 at a time
        try {
          await supabase.functions.invoke("call-ai-assist", {
            body: { action: "summarize_voicemail", voicemail_id: vm.id },
          });
          analyzed++;
        } catch (e) {
          console.error("Failed to analyze voicemail:", vm.id, e);
        }
      }
      return { analyzed };
    },
    onSuccess: (data) => {
      toast.success(`Analyzed ${data.analyzed} voicemails`);
    },
  });

  // Generate routing suggestions
  const suggestRoutingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("call-ai-assist", {
        body: { action: "suggest_routing", business_id: selectedBusiness?.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.suggestions?.length) {
        toast.success(`Generated ${data.suggestions.length} routing suggestions`);
      } else {
        toast.info("No routing improvements suggested");
      }
    },
  });

  // Convert signals to AI suggestions
  const suggestions: AISuggestion[] = (signals || []).map((signal: Record<string, unknown>) => ({
    id: signal.id as string,
    type: getTypeFromSignal(signal.signal_type as string),
    title: signal.title as string,
    description: signal.description as string || "",
    priority: signal.severity === "critical" ? "critical" : signal.severity === "warning" ? "high" : "normal",
    entity_type: signal.related_entity_type as string || "",
    entity_id: signal.related_entity_id as string || "",
    suggested_action: signal.suggested_action as string || "",
    confidence: 85,
    created_at: signal.created_at as string,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>AI Suggested Actions</CardTitle>
              <CardDescription>
                Intelligent recommendations based on call patterns
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {suggestions.length} suggestions
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeAllMutation.mutate()}
            disabled={!pendingAnalysis?.length || analyzeAllMutation.isPending}
          >
            <Brain className="h-4 w-4 mr-2" />
            Analyze {pendingAnalysis?.length || 0} Voicemails
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => suggestRoutingMutation.mutate()}
            disabled={suggestRoutingMutation.isPending}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Suggest Routing Improvements
          </Button>
        </div>

        {/* Suggestions List */}
        <ScrollArea className="h-[400px]">
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No AI suggestions at this time</p>
              <p className="text-sm">Run analysis to generate insights</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* AI Capabilities Summary */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-3">AI can help with:</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Summarize voicemails
            </div>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Tag caller intent
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Recommend routing fixes
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Draft callback SMS
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            AI does NOT answer calls automatically. It assists humans.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ suggestion }: { suggestion: AISuggestion }) {
  const getIcon = () => {
    switch (suggestion.type) {
      case "callback":
        return <Phone className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "routing":
        return <Users className="h-4 w-4" />;
      case "escalation":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getActionLink = () => {
    switch (suggestion.type) {
      case "callback":
        return "/communication-hub/call-intelligence/voicemail";
      case "routing":
        return "/communication-hub/call-settings/user-settings";
      default:
        return "/communication-hub/call-intelligence";
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${
      suggestion.priority === "critical" 
        ? "border-destructive/50 bg-destructive/5"
        : suggestion.priority === "high"
        ? "border-amber-500/50 bg-amber-500/5"
        : "hover:bg-muted/50"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          suggestion.priority === "critical" 
            ? "bg-destructive/10 text-destructive"
            : suggestion.priority === "high"
            ? "bg-amber-500/10 text-amber-600"
            : "bg-primary/10 text-primary"
        }`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{suggestion.title}</span>
            {suggestion.priority === "critical" && (
              <Badge variant="destructive" className="text-xs">Critical</Badge>
            )}
          </div>
          {suggestion.description && (
            <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
          )}
          {suggestion.suggested_action && (
            <div className="flex items-center gap-2 mt-3">
              <Button asChild variant="secondary" size="sm">
                <Link to={getActionLink()}>
                  {suggestion.suggested_action.substring(0, 30)}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <ThumbsDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTypeFromSignal(signalType: string): AISuggestion["type"] {
  if (signalType.includes("voicemail") || signalType.includes("repeat")) return "callback";
  if (signalType.includes("route") || signalType.includes("callable")) return "routing";
  if (signalType.includes("breach") || signalType.includes("critical")) return "escalation";
  return "routing";
}
