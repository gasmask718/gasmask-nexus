import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Award, ChevronDown, ChevronUp, Lightbulb, 
  AlertCircle, Star, Bot, User
} from "lucide-react";
import { CallQualityScore } from "@/hooks/useCallIntelligence";
import { cn } from "@/lib/utils";

interface CallQualityScoreCardProps {
  quality: CallQualityScore | null;
  compact?: boolean;
}

export function CallQualityScoreCard({ quality, compact = false }: CallQualityScoreCardProps) {
  const [isOpen, setIsOpen] = useState(!compact);

  if (!quality) {
    return null;
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const categoryScores = [
    { label: "Greeting", score: quality.greeting_score },
    { label: "Clarity", score: quality.clarity_score },
    { label: "Empathy", score: quality.empathy_score },
    { label: "Compliance", score: quality.compliance_score },
    { label: "Offer Delivery", score: quality.offer_delivery_score },
    { label: "Closing", score: quality.closing_score },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <div className={cn(
          "text-2xl font-bold",
          getScoreColor(quality.overall_score)
        )}>
          {quality.overall_score?.toFixed(0) ?? "—"}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Quality Score</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {quality.is_ai ? (
              <>
                <Bot className="h-3 w-3" />
                AI Agent
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                Human
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4" />
                Quality Score
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "text-2xl font-bold",
                  getScoreColor(quality.overall_score)
                )}>
                  {quality.overall_score?.toFixed(0) ?? "—"}
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <Badge variant="outline" className="gap-1">
                  {quality.is_ai ? (
                    <>
                      <Bot className="h-3 w-3" />
                      AI
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" />
                      Human
                    </>
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
            {/* Category Scores */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">Category Breakdown</h4>
              <div className="grid gap-2">
                {categoryScores.map((cat) => (
                  <div key={cat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{cat.label}</span>
                      <span className={getScoreColor(cat.score)}>
                        {cat.score?.toFixed(0) ?? "—"}
                      </span>
                    </div>
                    <Progress
                      value={cat.score ?? 0}
                      className="h-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths */}
            {quality.strengths && quality.strengths.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <Star className="h-3 w-3 text-green-500" />
                  Strengths
                </h4>
                <ul className="text-sm space-y-1">
                  {quality.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Star className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {quality.issues && quality.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  Issues
                </h4>
                <ul className="text-sm space-y-1">
                  {quality.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 text-red-500 mt-1 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Coaching Tips */}
            {quality.coaching_tips && quality.coaching_tips.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-yellow-500" />
                  Coaching Tips
                </h4>
                <ul className="text-sm space-y-1">
                  {quality.coaching_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Lightbulb className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}