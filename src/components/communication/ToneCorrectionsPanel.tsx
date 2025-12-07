import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { AgentToneCorrection } from '@/hooks/useLanguagePersonality';
import { formatDistanceToNow } from 'date-fns';

interface ToneCorrectionsPanelProps {
  corrections: AgentToneCorrection[];
  isLoading: boolean;
}

export default function ToneCorrectionsPanel({ corrections, isLoading }: ToneCorrectionsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            AI Tone Corrections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          AI Tone Corrections
          {corrections?.length > 0 && (
            <Badge variant="secondary">{corrections.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {corrections?.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tone corrections yet.</p>
            <p className="text-sm">The supervisor AI will log corrections here.</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {corrections?.map((correction) => (
                <div
                  key={correction.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                      {correction.previous_tone}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                      {correction.corrected_tone}
                    </Badge>
                  </div>
                  {correction.reason && (
                    <p className="text-sm text-muted-foreground">{correction.reason}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(correction.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
