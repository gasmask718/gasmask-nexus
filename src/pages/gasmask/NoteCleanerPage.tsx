import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Search, Check, SkipForward, Edit3, CheckCheck,
  SkipBack, AlertTriangle, Loader2, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DirtyNote {
  id: string;
  store_id: string;
  note_text: string;
  created_at: string;
  store_name?: string;
}

interface CleanedNote extends DirtyNote {
  cleaned_text: string;
  editing: boolean;
  status: 'pending' | 'approved' | 'skipped';
}

function needsCleaning(note: string | null): boolean {
  if (!note) return false;
  const htmlPattern = /<\/?[a-z][\s\S]*?>/i;
  const entityPattern = /&amp;|&nbsp;|&lt;|&gt;|&#\d+;/i;
  const brokenCharPattern = /â|Â|donâ|canâ|isnâ|wonâ|didnâ/;
  return htmlPattern.test(note) || entityPattern.test(note) || brokenCharPattern.test(note);
}

export default function NoteCleanerPage() {
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [dirtyNotes, setDirtyNotes] = useState<DirtyNote[]>([]);
  const [cleanedNotes, setCleanedNotes] = useState<CleanedNote[]>([]);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [scanned, setScanned] = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanned(false);
    setCleanedNotes([]);
    setApprovedCount(0);
    try {
      // Fetch notes with HTML markers
      const { data, error } = await supabase
        .from('store_notes')
        .select('id, store_id, note_text, created_at, store_master!store_notes_store_id_fkey(store_name)')
        .or('note_text.ilike.%<div>%,note_text.ilike.%<br>%,note_text.ilike.%<p %,note_text.ilike.%<span>%,note_text.ilike.%&amp;%,note_text.ilike.%&nbsp;%,note_text.ilike.%â%')
        .is('cleaning_status', null)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;

      const filtered = (data || [])
        .filter((n: any) => needsCleaning(n.note_text))
        .map((n: any) => ({
          id: n.id,
          store_id: n.store_id,
          note_text: n.note_text,
          created_at: n.created_at,
          store_name: (n.store_master as any)?.store_name || 'Unknown Store',
        }));

      setDirtyNotes(filtered);
      setScanned(true);
      toast.success(`Found ${filtered.length} notes needing cleanup`);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  const cleanAllNotes = useCallback(async () => {
    if (!dirtyNotes.length) return;
    setCleaning(true);
    setCleaningProgress(0);
    const results: CleanedNote[] = [];

    for (let i = 0; i < dirtyNotes.length; i++) {
      const note = dirtyNotes[i];
      try {
        const { data, error } = await supabase.functions.invoke('clean-note', {
          body: { rawNote: note.note_text },
        });
        if (error) throw error;
        results.push({
          ...note,
          cleaned_text: data.cleanedNote || note.note_text,
          editing: false,
          status: 'pending',
        });
      } catch (err: any) {
        // On rate limit, pause and retry
        if (err.message?.includes('429')) {
          toast.warning('Rate limited — pausing for 5 seconds...');
          await new Promise(r => setTimeout(r, 5000));
          i--; // retry this note
          continue;
        }
        results.push({
          ...note,
          cleaned_text: `[CLEANING FAILED: ${err.message}]`,
          editing: false,
          status: 'pending',
        });
      }
      setCleaningProgress(Math.round(((i + 1) / dirtyNotes.length) * 100));
      // Small delay to avoid rate limits
      if (i < dirtyNotes.length - 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    setCleanedNotes(results);
    setCleaning(false);
    toast.success(`${results.length} notes cleaned — review and approve below`);
  }, [dirtyNotes]);

  const approveNote = useCallback(async (note: CleanedNote) => {
    try {
      // Backup original and save cleaned
      const { error: updateErr } = await supabase
        .from('store_notes')
        .update({
          original_note: note.note_text,
          note_text: note.cleaned_text,
          is_legacy: true,
          needs_cleaning: false,
          cleaning_status: 'approved',
          cleaned_at: new Date().toISOString(),
        })
        .eq('id', note.id);
      if (updateErr) throw updateErr;

      // Log
      await (supabase as any).from('note_cleaning_log').insert({
        store_id: note.store_id,
        note_id: note.id,
        original_note: note.note_text,
        cleaned_note: note.cleaned_text,
        status: 'approved',
        approved_at: new Date().toISOString(),
      });

      setCleanedNotes(prev =>
        prev.map(n => (n.id === note.id ? { ...n, status: 'approved' as const } : n))
      );
      setApprovedCount(prev => prev + 1);
      toast.success('Note approved & saved');
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    }
  }, []);

  const skipNote = useCallback(async (noteId: string) => {
    await supabase
      .from('store_notes')
      .update({ cleaning_status: 'skipped' })
      .eq('id', noteId);

    setCleanedNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, status: 'skipped' as const } : n))
    );
  }, []);

  const toggleEdit = useCallback((noteId: string) => {
    setCleanedNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, editing: !n.editing } : n))
    );
  }, []);

  const updateCleanedText = useCallback((noteId: string, text: string) => {
    setCleanedNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, cleaned_text: text } : n))
    );
  }, []);

  const approveAll = useCallback(async () => {
    const pending = cleanedNotes.filter(n => n.status === 'pending');
    for (const note of pending) {
      await approveNote(note);
    }
    toast.success(`${pending.length} notes approved`);
  }, [cleanedNotes, approveNote]);

  const skipAll = useCallback(async () => {
    const pending = cleanedNotes.filter(n => n.status === 'pending');
    for (const note of pending) {
      await skipNote(note.id);
    }
    toast.info(`${pending.length} notes skipped`);
  }, [cleanedNotes, skipNote]);

  const pendingNotes = cleanedNotes.filter(n => n.status === 'pending');
  const processedCount = cleanedNotes.filter(n => n.status !== 'pending').length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-lg">Note Cleaner Agent</CardTitle>
                <CardDescription>
                  Scans account notes for legacy HTML formatting and rewrites in proper English
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {scanned && (
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {dirtyNotes.length} notes need cleaning
                </Badge>
              )}
              <Button onClick={runScan} disabled={scanning || cleaning} className="gap-2">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {scanning ? 'Scanning...' : 'Run Full Scan'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress / Cleaning bar */}
      {cleaning && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cleaning notes with AI...</span>
              <span className="font-medium">{cleaningProgress}%</span>
            </div>
            <Progress value={cleaningProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Action bar when scan done but not yet cleaned */}
      {scanned && dirtyNotes.length > 0 && cleanedNotes.length === 0 && !cleaning && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">
                {dirtyNotes.length} notes with legacy HTML detected
              </span>
            </div>
            <Button onClick={cleanAllNotes} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Clean All with AI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Batch actions when cleaned */}
      {cleanedNotes.length > 0 && pendingNotes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {processedCount} of {cleanedNotes.length} processed
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={skipAll} className="gap-1">
                  <SkipBack className="h-3 w-3" /> Skip All
                </Button>
                <Button size="sm" onClick={approveAll} className="gap-1">
                  <CheckCheck className="h-3 w-3" /> Approve All
                </Button>
              </div>
            </div>
            <Progress
              value={Math.round((processedCount / cleanedNotes.length) * 100)}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      {cleanedNotes.length > 0 && (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3 pr-2">
            {cleanedNotes.map(note => (
              <Card
                key={note.id}
                className={cn(
                  'transition-all',
                  note.status === 'approved' && 'border-green-500/30 bg-green-500/5 opacity-60',
                  note.status === 'skipped' && 'border-muted opacity-40'
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Note header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{note.store_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {note.status !== 'pending' && (
                      <Badge
                        variant={note.status === 'approved' ? 'default' : 'secondary'}
                        className={cn(
                          'text-xs',
                          note.status === 'approved' && 'bg-green-500'
                        )}
                      >
                        {note.status === 'approved' ? 'Approved' : 'Skipped'}
                      </Badge>
                    )}
                  </div>

                  {/* Before / After */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Before */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-medium">Before (raw)</span>
                      <div className="bg-muted/50 rounded-md p-2 text-xs font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto border border-border">
                        {note.note_text}
                      </div>
                    </div>

                    {/* After */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-medium">After (cleaned)</span>
                      {note.editing ? (
                        <Textarea
                          value={note.cleaned_text}
                          onChange={(e) => updateCleanedText(note.id, e.target.value)}
                          className="text-xs min-h-[120px] max-h-48"
                        />
                      ) : (
                        <div className="bg-green-500/5 rounded-md p-2 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto border border-green-500/20">
                          {note.cleaned_text}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {note.status === 'pending' && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => toggleEdit(note.id)}
                      >
                        <Edit3 className="h-3 w-3" />
                        {note.editing ? 'Done Editing' : 'Edit Before Saving'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => skipNote(note.id)}
                      >
                        <SkipForward className="h-3 w-3" /> Skip
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => approveNote(note)}
                      >
                        <Check className="h-3 w-3" /> Approve & Save
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Empty state */}
      {scanned && dirtyNotes.length === 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-8 text-center">
            <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="font-semibold">All clean!</p>
            <p className="text-sm text-muted-foreground">No legacy HTML notes found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
