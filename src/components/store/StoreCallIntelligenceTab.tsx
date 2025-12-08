import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Headphones, FileText, Star, AlertCircle } from "lucide-react";
import { CallRecordingPlayer, CallTranscriptPanel, CallQualityScoreCard } from "@/components/communication/intelligence";

interface StoreCallIntelligenceTabProps {
  storeId: string;
}

export function StoreCallIntelligenceTab({ storeId }: StoreCallIntelligenceTabProps) {
  // Fetch call recordings for this store
  const { data: recordings, isLoading: loadingRecordings } = useQuery({
    queryKey: ['store-call-recordings', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_recordings')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Fetch call analytics for this store
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['store-call-analytics', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_analytics')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  // Fetch quality scores for this store
  const { data: qualityScores, isLoading: loadingScores } = useQuery({
    queryKey: ['store-call-quality', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_quality_scores')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  const isLoading = loadingRecordings || loadingAnalytics || loadingScores;

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = (recordings?.length || 0) > 0 || (analytics?.length || 0) > 0;

  if (!hasData) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="py-8">
          <div className="text-center space-y-2">
            <Headphones className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No call intelligence data available</p>
            <p className="text-sm text-muted-foreground">
              Call recordings, transcripts, and quality scores will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Average quality score
  const avgQuality = qualityScores?.length 
    ? qualityScores.reduce((sum, q) => sum + (Number(q.overall_score) || 0), 0) / qualityScores.length
    : null;

  // Sentiment distribution
  const sentimentCounts = analytics?.reduce((acc, a) => {
    const s = a.sentiment || 'neutral';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Headphones className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{recordings?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Recordings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {avgQuality ? avgQuality.toFixed(0) : '--'}/100
                </p>
                <p className="text-sm text-muted-foreground">Avg Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{analytics?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Overview */}
      {Object.keys(sentimentCounts).length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sentiment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                <Badge
                  key={sentiment}
                  variant="outline"
                  className={
                    sentiment === 'positive' ? 'border-green-500 text-green-600' :
                    sentiment === 'negative' ? 'border-red-500 text-red-600' :
                    sentiment === 'mixed' ? 'border-yellow-500 text-yellow-600' :
                    ''
                  }
                >
                  {sentiment}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Call List */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            Recent Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {recordings?.map((recording) => {
                const matchingAnalytics = analytics?.find(a => a.recording_id === recording.id);
                const matchingQuality = qualityScores?.find(q => q.recording_id === recording.id);

                return (
                  <div key={recording.id} className="p-4 rounded-lg bg-secondary/30 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(recording.created_at || '').toLocaleDateString()} at{' '}
                          {new Date(recording.created_at || '').toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {recording.recording_duration ? `${Math.floor(recording.recording_duration / 60)}:${(recording.recording_duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                        </p>
                      </div>
                      {matchingQuality && (
                        <Badge 
                          variant={Number(matchingQuality.overall_score) >= 70 ? 'default' : 'destructive'}
                        >
                          {Number(matchingQuality.overall_score).toFixed(0)}/100
                        </Badge>
                      )}
                    </div>

                    {/* Recording Player */}
                    {recording.recording_url && (
                      <CallRecordingPlayer recording={recording} compact />
                    )}

                    {/* Analytics Summary */}
                    {matchingAnalytics && (
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        {matchingAnalytics.summary && (
                          <p className="text-sm text-muted-foreground">
                            {matchingAnalytics.summary}
                          </p>
                        )}
                        {matchingAnalytics.tags && matchingAnalytics.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(matchingAnalytics.tags as string[]).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quality Issues */}
                    {matchingQuality?.issues && (matchingQuality.issues as string[]).length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          <span>Issues: {(matchingQuality.issues as string[]).slice(0, 2).join(', ')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
