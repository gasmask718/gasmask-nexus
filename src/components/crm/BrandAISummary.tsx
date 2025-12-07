import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";

interface BrandAISummaryProps {
  insight: {
    ai_summary: string | null;
    ai_top_actions: string | null;
    calculated_at: string;
  } | null;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function BrandAISummary({ insight, onGenerate, isGenerating }: BrandAISummaryProps) {
  const actions = insight?.ai_top_actions?.split("\n• ").filter(Boolean) || [];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            AI Brand Summary
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {insight ? "Refresh" : "Generate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insight ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {insight.ai_summary}
            </p>
            
            {actions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top Actions:</p>
                <ul className="space-y-1.5">
                  {actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(insight.calculated_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Generate AI-powered insights for this brand
            </p>
            <Button onClick={onGenerate} disabled={isGenerating}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
