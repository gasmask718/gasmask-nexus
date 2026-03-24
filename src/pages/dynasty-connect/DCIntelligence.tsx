import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Phone, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DCIntelligence() {
  const [selectedCall, setSelectedCall] = useState<any>(null);

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['dc-call-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const outcomeColor = (o: string) => {
    if (o === 'booked' || o === 'interested') return 'text-green-500 border-green-500';
    if (o === 'callback') return 'text-blue-500 border-blue-500';
    if (o === 'not-interested' || o === 'wrong-number') return 'text-red-500 border-red-500';
    return '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Call Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          {callLogs.length} calls logged · Click any call to view transcript
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : callLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No AI calls logged yet.</p>
            <p className="text-xs">Calls will appear here after completing the Twilio → ElevenLabs → Status pipeline.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {callLogs.map((call: any) => (
            <Card
              key={call.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedCall(call)}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{call.phone_number || 'Unknown Number'}</p>
                      <Badge variant="outline" className={outcomeColor(call.outcome || '')}>
                        {call.outcome || 'pending'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(call.created_at).toLocaleString()} · 
                      {call.duration_seconds ? ` ${Math.round(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : ' —'} · 
                      {call.language || 'en'}
                    </p>
                    {call.ai_summary && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{call.ai_summary}</p>
                    )}
                  </div>
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transcript Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Call Transcript — {selectedCall?.phone_number || 'Unknown'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCall?.ai_summary && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">AI Summary</p>
                <p className="text-sm">{selectedCall.ai_summary}</p>
              </div>
            )}
            <div className="flex gap-4 text-sm">
              <Badge variant="outline">{selectedCall?.outcome || 'pending'}</Badge>
              <span className="text-muted-foreground">
                {selectedCall?.duration_seconds ? `${Math.round(selectedCall.duration_seconds / 60)}m ${selectedCall.duration_seconds % 60}s` : '—'}
              </span>
              <span className="text-muted-foreground">{selectedCall?.language || 'en'}</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Full Transcript</p>
              <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono text-xs max-h-96 overflow-auto">
                {selectedCall?.transcription || selectedCall?.full_transcript || 'No transcript available.'}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
