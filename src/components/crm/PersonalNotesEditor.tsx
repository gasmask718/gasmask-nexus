import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Save, History, Clock, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface NotesHistory {
  id: string;
  content: string;
  edited_at: string;
  edited_by?: string;
}

interface PersonalNotesEditorProps {
  entityType: 'contact' | 'store' | 'brand';
  entityId: string;
  brandColor?: string;
  className?: string;
}

export function PersonalNotesEditor({ 
  entityType, 
  entityId, 
  brandColor = '#FF4F9D',
  className = ''
}: PersonalNotesEditorProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<NotesHistory[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const originalNotesRef = useRef('');

  // Fetch notes on mount
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('crm_personal_notes' as any)
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching notes:', error);
        }

        if (data) {
          const noteData = data as any;
          setNotes(noteData.content || '');
          originalNotesRef.current = noteData.content || '';
          setLastSaved(new Date(noteData.updated_at || noteData.created_at));
        }
      } catch (err) {
        console.error('Failed to fetch notes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (entityId) {
      fetchNotes();
    }
  }, [entityType, entityId]);

  // Fetch history when requested
  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_personal_notes_history' as any)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('edited_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setHistory((data as unknown) as NotesHistory[]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // Autosave function
  const saveNotes = useCallback(async (content: string) => {
    if (content === originalNotesRef.current) return;
    
    setIsSaving(true);
    try {
      // First, save history of current version if it exists
      if (originalNotesRef.current) {
        await supabase
          .from('crm_personal_notes_history' as any)
          .insert({
            entity_type: entityType,
            entity_id: entityId,
            content: originalNotesRef.current,
            edited_at: new Date().toISOString(),
          });
      }

      // Upsert the new notes
      const { error } = await supabase
        .from('crm_personal_notes' as any)
        .upsert({
          entity_type: entityType,
          entity_id: entityId,
          content: content,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'entity_type,entity_id'
        });

      if (error) throw error;

      originalNotesRef.current = content;
      setLastSaved(new Date());
    } catch (err: any) {
      console.error('Failed to save notes:', err);
      toast({
        title: 'Failed to save notes',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [entityType, entityId, toast]);

  // Debounced autosave
  const handleNotesChange = (value: string) => {
    setNotes(value);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1500); // Autosave after 1.5 seconds of inactivity
  };

  // Manual save
  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveNotes(notes);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} border-t-4`} style={{ borderTopColor: brandColor }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" style={{ color: brandColor }} />
            Personal Notes
          </CardTitle>
          <div className="flex items-center gap-2">
            {isSaving ? (
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </Badge>
            ) : lastSaved ? (
              <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                <Check className="w-3 h-3" />
                Saved
              </Badge>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className="h-7 px-2"
            >
              <History className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualSave}
              disabled={isSaving || notes === originalNotesRef.current}
              className="h-7 px-2"
            >
              <Save className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add personal notes about this record... (auto-saves)"
          className="min-h-[100px] resize-none bg-background/50"
        />
        
        {lastSaved && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last saved: {format(lastSaved, 'MMM d, yyyy h:mm a')}
          </p>
        )}

        {/* Edit History Panel */}
        {showHistory && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <History className="w-4 h-4" />
              Edit History
            </h4>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No edit history yet</p>
            ) : (
              <ScrollArea className="max-h-32">
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="text-xs p-2 rounded bg-background/50 border cursor-pointer hover:bg-background/80"
                      onClick={() => {
                        setNotes(entry.content);
                        toast({ title: 'Previous version restored (not saved yet)' });
                      }}
                    >
                      <p className="text-muted-foreground mb-1">
                        {format(new Date(entry.edited_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      <p className="line-clamp-2">{entry.content || '(empty)'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
