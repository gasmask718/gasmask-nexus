import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Check, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function needsCleaning(note: string | null): boolean {
  if (!note) return false;
  const htmlPattern = /<\/?[a-z][\s\S]*?>/i;
  const entityPattern = /&amp;|&nbsp;|&lt;|&gt;|&#\d+;/i;
  const brokenCharPattern = /â|Â|donâ|canâ|isnâ|wonâ|didnâ/;
  return htmlPattern.test(note) || entityPattern.test(note) || brokenCharPattern.test(note);
}

interface CleanNoteButtonProps {
  noteId: string;
  storeId: string;
  noteText: string;
  size?: 'sm' | 'icon';
}

export function CleanNoteButton({ noteId, storeId, noteText, size = 'sm' }: CleanNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanedText, setCleanedText] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  if (!needsCleaning(noteText)) return null;

  const handleClean = async () => {
    setCleaning(true);
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke('clean-note', {
        body: { rawNote: noteText },
      });
      if (error) throw error;
      setCleanedText(data.cleanedNote || noteText);
    } catch (err: any) {
      toast.error(err.message || 'Cleaning failed');
      setCleanedText('');
    } finally {
      setCleaning(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await supabase
        .from('store_notes')
        .update({
          original_note: noteText,
          note_text: cleanedText,
          is_legacy: true,
          needs_cleaning: false,
          cleaning_status: 'approved',
          cleaned_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      await (supabase as any).from('note_cleaning_log').insert({
        store_id: storeId,
        note_id: noteId,
        original_note: noteText,
        cleaned_note: cleanedText,
        status: 'approved',
        approved_at: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ['store-notes', storeId] });
      toast.success('Note cleaned & saved');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size={size}
        className="gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
        onClick={handleClean}
      >
        <Sparkles className="h-3 w-3" />
        {size !== 'icon' && 'Clean'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Clean Legacy Note
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Badge variant="outline" className="text-[10px]">Before (raw)</Badge>
              <div className="bg-muted/50 rounded-md p-2 text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto border border-border">
                {noteText}
              </div>
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600">
                After (cleaned)
              </Badge>
              {cleaning ? (
                <div className="flex items-center justify-center h-32 bg-muted/30 rounded-md border border-border">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : editing ? (
                <Textarea
                  value={cleanedText}
                  onChange={(e) => setCleanedText(e.target.value)}
                  className="text-xs min-h-[120px] max-h-64"
                />
              ) : (
                <div className="bg-green-500/5 rounded-md p-2 text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto border border-green-500/20">
                  {cleanedText || 'Cleaning...'}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="gap-1">
              <Edit3 className="h-3 w-3" />
              {editing ? 'Done Editing' : 'Edit'}
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={!cleanedText || saving || cleaning}
              className="gap-1"
            >
              <Check className="h-3 w-3" />
              {saving ? 'Saving...' : 'Approve & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
