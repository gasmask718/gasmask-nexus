import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Brain, CheckCircle2, Clock, Loader2, MessageSquare, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface AccountNotesPanelProps {
  entityType: string;
  entityId: string;
  entityLabel?: string;
}

const NOTE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'transaction', label: 'Transaction' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'call_log', label: 'Call Log' },
  { value: 'ai_analysis', label: 'AI Analysis' },
  { value: 'update', label: 'Update' },
  { value: 'alert', label: 'Alert' },
];

const noteTypeBadgeColor: Record<string, string> = {
  general: 'bg-muted text-muted-foreground',
  transaction: 'bg-emerald-500/20 text-emerald-400',
  status_change: 'bg-blue-500/20 text-blue-400',
  call_log: 'bg-purple-500/20 text-purple-400',
  ai_analysis: 'bg-cyan-500/20 text-cyan-400',
  update: 'bg-amber-500/20 text-amber-400',
  alert: 'bg-red-500/20 text-red-400',
};

export default function AccountNotesPanel({ entityType, entityId, entityLabel }: AccountNotesPanelProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState('general');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['account-notes', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_notes' as any)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entityId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteBody.trim()) throw new Error('Note body required');
      const { data: { user } } = await supabase.auth.getUser();

      // Insert the note
      const { data: note, error } = await supabase
        .from('account_notes' as any)
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          note_body: noteBody.trim(),
          note_type: noteType,
          created_by: user?.email || 'system',
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Fire AI analysis
      try {
        const resp = await supabase.functions.invoke('analyze-account-note', {
          body: {
            note_id: (note as any).id,
            note_body: noteBody.trim(),
            entity_type: entityType,
            entity_id: entityId,
          },
        });
        if (resp.error) console.error('AI analysis error:', resp.error);
      } catch (e) {
        console.error('AI analysis failed:', e);
      }

      return note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-notes', entityType, entityId] });
      setNoteBody('');
      setNoteType('general');
      setShowAdd(false);
      toast.success('Note saved & AI analysis triggered');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Account Notes {entityLabel && <span className="text-muted-foreground">— {entityLabel}</span>}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-background/50">
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Enter note..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2 items-center">
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => addNoteMutation.mutate()}
                disabled={addNoteMutation.isPending || !noteBody.trim()}
              >
                {addNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save & Analyze
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No notes yet. Add the first note.</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {notes.map((note: any) => (
              <div key={note.id} className="border border-border/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={noteTypeBadgeColor[note.note_type] || noteTypeBadgeColor.general}>
                      {note.note_type?.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">by {note.created_by || 'system'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <p className="text-sm">{note.note_body}</p>

                {/* AI Analysis */}
                {note.ai_summary && (
                  <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10 space-y-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <Brain className="h-3 w-3" /> AI Analysis
                    </div>
                    <p className="text-xs text-muted-foreground">{note.ai_summary}</p>

                    {note.ai_action_items?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Action Items
                        </span>
                        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                          {note.ai_action_items.map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {note.ai_risk_flags?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-400" /> Risk Flags
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {note.ai_risk_flags.map((flag: string, i: number) => (
                            <Badge key={i} variant="destructive" className="text-[10px]">{flag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
