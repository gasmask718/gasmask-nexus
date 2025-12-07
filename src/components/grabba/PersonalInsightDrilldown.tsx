// V8: Personal Insight Drilldown Modal
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingUp, Lightbulb, MessageSquare, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PersonalInsightDrilldownProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  insightText: string;
  category: "red_flag" | "opportunity" | "pattern";
  profileSummary?: string;
}

interface InsightExplanation {
  explanation: string;
  scripts: string[];
  actions: string[];
}

const CATEGORY_CONFIG = {
  red_flag: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    title: "Risk Flag Analysis",
  },
  opportunity: {
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    title: "Growth Opportunity",
  },
  pattern: {
    icon: Lightbulb,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    title: "Pattern Analysis",
  },
};

export function PersonalInsightDrilldown({
  open,
  onClose,
  storeId,
  insightText,
  category,
  profileSummary,
}: PersonalInsightDrilldownProps) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<InsightExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  useEffect(() => {
    if (open && insightText) {
      fetchExplanation();
    }
  }, [open, insightText]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("explain-customer-insight", {
        body: {
          storeId,
          insightText,
          category,
          profileSummary,
        },
      });

      if (fnError) throw fnError;
      setExplanation(data);
    } catch (err) {
      console.error("Error fetching explanation:", err);
      setError("Failed to generate explanation. Please try again.");
      // Provide fallback content
      setExplanation({
        explanation: `This ${category === "red_flag" ? "risk flag" : "opportunity"} indicates: ${insightText}`,
        scripts: [
          "Ask about their current situation and any challenges they're facing.",
          "Listen actively and acknowledge their concerns.",
          "Offer specific solutions based on their needs.",
        ],
        actions: [
          "Schedule a follow-up conversation within 48 hours.",
          "Document this insight in the customer notes.",
          "Assign to a team member for immediate action.",
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <DialogTitle className={config.color}>{config.title}</DialogTitle>
              <DialogDescription className="mt-1">
                Deep dive into this insight with AI-powered recommendations
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Original Insight */}
          <div className={`rounded-lg p-4 ${config.bgColor}`}>
            <p className="font-medium">{insightText}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Analyzing insight...</span>
            </div>
          ) : explanation ? (
            <>
              {/* AI Explanation */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Why This Matters
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {explanation.explanation}
                </p>
              </div>

              {/* Recommended Scripts */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Recommended Scripts
                </h3>
                <div className="space-y-2">
                  {explanation.scripts.map((script, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-muted/30 p-3 text-sm italic"
                    >
                      "{script}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Concrete Actions */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Next Actions
                </h3>
                <div className="space-y-2">
                  {explanation.actions.map((action, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {i + 1}
                      </Badge>
                      <p className="text-sm">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fetchExplanation}
              >
                Try Again
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
