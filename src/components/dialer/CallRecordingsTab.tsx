import { useState } from 'react';
import { useCallRecordings } from '@/hooks/useCallRecordings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, PlayCircle, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const outcomeColors: Record<string, string> = {
  interested: 'bg-green-500/10 text-green-600 border-green-500/30',
  converted: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  callback: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  not_interested: 'bg-red-500/10 text-red-600 border-red-500/30',
  no_answer: 'bg-muted text-muted-foreground',
  voicemail: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

export default function CallRecordingsTab() {
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: recordings, isLoading } = useCallRecordings(
    outcomeFilter !== 'all' ? { outcome: outcomeFilter } : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All outcomes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="callback">Callback</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{recordings?.length || 0} recordings</span>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : !recordings?.length ? (
            <div className="text-center py-16">
              <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No call recordings found.</p>
              <p className="text-xs text-muted-foreground mt-1">Recordings appear after calls are completed.</p>
            </div>
          ) : (
            recordings.map((call: any) => (
              <Card key={call.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9"
                      onClick={() => {
                        if (call.elevenlabs_call_id) {
                          window.open(
                            `https://elevenlabs.io/app/conversational-ai/history/${call.elevenlabs_call_id}`,
                            '_blank'
                          );
                        } else {
                          setExpandedId(expandedId === call.id ? null : call.id);
                        }
                      }}
                    >
                      {call.elevenlabs_call_id ? (
                        <ExternalLink className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {call.outreach_leads?.store_name || 'Unknown Store'}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${outcomeColors[call.outcome] || ''}`}>
                          {call.outcome || 'unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{new Date(call.call_date).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{Math.floor((call.duration_seconds || 0) / 60)}m {(call.duration_seconds || 0) % 60}s</span>
                        {call.call_score != null && (
                          <>
                            <span>·</span>
                            <span className={call.call_score >= 70 ? 'text-green-600' : call.call_score >= 40 ? 'text-amber-600' : 'text-red-600'}>
                              Score: {call.call_score}
                            </span>
                          </>
                        )}
                        {call.language_detected && (
                          <>
                            <span>·</span>
                            <span>{call.language_detected}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedId === call.id && call.transcript && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {call.transcript}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
