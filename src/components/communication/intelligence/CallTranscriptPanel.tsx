import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, ChevronDown, ChevronUp, AlertTriangle, 
  ThumbsUp, ThumbsDown, Minus, Copy, Check
} from "lucide-react";
import { CallAnalytics } from "@/hooks/useCallIntelligence";
import { cn } from "@/lib/utils";

interface CallTranscriptPanelProps {
  analytics: CallAnalytics | null;
  compact?: boolean;
}

export function CallTranscriptPanel({ analytics, compact = false }: CallTranscriptPanelProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const [copied, setCopied] = useState(false);

  if (!analytics) {
    return null;
  }

  const getSentimentIcon = () => {
    switch (analytics.sentiment) {
      case "positive":
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case "negative":
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      case "mixed":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentColor = () => {
    switch (analytics.sentiment) {
      case "positive":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "negative":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "mixed":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleCopy = async () => {
    if (analytics.transcript) {
      await navigator.clipboard.writeText(analytics.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript & Analysis
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("gap-1", getSentimentColor())}>
                  {getSentimentIcon()}
                  {analytics.sentiment || "Unknown"}
                  {analytics.sentiment_score !== null && (
                    <span className="ml-1">({analytics.sentiment_score > 0 ? "+" : ""}{analytics.sentiment_score})</span>
                  )}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Summary */}
            {analytics.summary && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Summary</h4>
                <p className="text-sm">{analytics.summary}</p>
              </div>
            )}

            {/* Tags */}
            {analytics.tags && analytics.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {analytics.tags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant={tag === "policy_violation" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {tag.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Objections */}
            {analytics.objections && analytics.objections.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Objections</h4>
                <ul className="text-sm space-y-1">
                  {analytics.objections.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Promises */}
            {analytics.promises && analytics.promises.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Promises Made</h4>
                <ul className="text-sm space-y-1">
                  {analytics.promises.map((promise, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                      <span>{promise}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            {analytics.next_steps && analytics.next_steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Recommended Next Steps</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {analytics.next_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Full Transcript */}
            {analytics.transcript && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">Full Transcript</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-48 rounded-md border p-3">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {analytics.transcript}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}