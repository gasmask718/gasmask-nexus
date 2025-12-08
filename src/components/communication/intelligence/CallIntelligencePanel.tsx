import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Headphones, FileText, Award, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { CallRecordingPlayer } from "./CallRecordingPlayer";
import { CallTranscriptPanel } from "./CallTranscriptPanel";
import { CallQualityScoreCard } from "./CallQualityScoreCard";
import { 
  useCallIntelligenceBySession, 
  useCallIntelligenceByRecording,
  useAnalyzeTranscript 
} from "@/hooks/useCallIntelligence";

interface CallIntelligencePanelProps {
  sessionId?: string | null;
  recordingId?: string | null;
  isAI?: boolean;
}

export function CallIntelligencePanel({ 
  sessionId, 
  recordingId, 
  isAI = false 
}: CallIntelligencePanelProps) {
  const [manualTranscript, setManualTranscript] = useState("");
  
  // Use the appropriate hook based on what ID we have
  const sessionQuery = useCallIntelligenceBySession(sessionId || null);
  const recordingQuery = useCallIntelligenceByRecording(recordingId || null);
  
  const { data, isLoading } = sessionId ? sessionQuery : recordingQuery;
  const analyzeTranscript = useAnalyzeTranscript();

  const { recording, analytics, quality } = data || {};

  const handleAnalyze = () => {
    if (!manualTranscript.trim()) return;
    
    analyzeTranscript.mutate({
      transcript: manualTranscript,
      recordingId: recording?.id,
      isAI,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Call Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasIntelligence = recording || analytics || quality;

  if (!hasIntelligence && !sessionId && !recordingId) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Call Intelligence
          </CardTitle>
          {analytics && (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              AI Analyzed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="recording" className="text-xs gap-1">
              <Headphones className="h-3 w-3" />
              Recording
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="quality" className="text-xs gap-1">
              <Award className="h-3 w-3" />
              Quality
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              {recording && (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Headphones className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">
                    {recording.recording_duration 
                      ? `${Math.floor(recording.recording_duration / 60)}:${(recording.recording_duration % 60).toString().padStart(2, '0')}`
                      : "—"
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
              )}
              
              {analytics && (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className={`h-4 w-4 mx-auto mb-1 rounded-full ${
                    analytics.sentiment === 'positive' ? 'bg-green-500' :
                    analytics.sentiment === 'negative' ? 'bg-red-500' :
                    analytics.sentiment === 'mixed' ? 'bg-yellow-500' : 'bg-muted-foreground'
                  }`} />
                  <div className="text-lg font-bold capitalize">
                    {analytics.sentiment || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Sentiment</div>
                </div>
              )}
              
              {quality && (
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <Award className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className={`text-lg font-bold ${
                    (quality.overall_score || 0) >= 80 ? 'text-green-500' :
                    (quality.overall_score || 0) >= 60 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {quality.overall_score?.toFixed(0) || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Quality</div>
                </div>
              )}
            </div>

            {/* Summary */}
            {analytics?.summary && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Summary</h4>
                <p className="text-sm">{analytics.summary}</p>
              </div>
            )}

            {/* Tags */}
            {analytics?.tags && analytics.tags.length > 0 && (
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
            )}

            {/* Next Steps */}
            {analytics?.next_steps && analytics.next_steps.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">Next Steps</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {analytics.next_steps.slice(0, 3).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Manual Analysis */}
            {!analytics && (
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-medium">Analyze Transcript</h4>
                <Textarea
                  placeholder="Paste the call transcript here to analyze..."
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  rows={4}
                />
                <Button 
                  onClick={handleAnalyze}
                  disabled={!manualTranscript.trim() || analyzeTranscript.isPending}
                  className="w-full gap-2"
                >
                  {analyzeTranscript.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recording" className="mt-4">
            <CallRecordingPlayer recording={recording || null} />
            {!recording && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No recording available for this call
              </div>
            )}
          </TabsContent>

          <TabsContent value="transcript" className="mt-4">
            <CallTranscriptPanel analytics={analytics || null} />
            {!analytics && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No transcript available. Use the Overview tab to analyze a transcript.
              </div>
            )}
          </TabsContent>

          <TabsContent value="quality" className="mt-4">
            <CallQualityScoreCard quality={quality || null} />
            {!quality && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No quality score available. Analyze a transcript first.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}