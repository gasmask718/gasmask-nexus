import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface StoreNote {
  id: string;
  note_text: string;
}

interface AddNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess: () => void;
  editingNote?: StoreNote | null;
}

export function AddNoteModal({ open, onOpenChange, storeId, storeName, onSuccess, editingNote }: AddNoteModalProps) {
  const { user } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Resolve storeId to store_master.id
  const {
    storeMasterId,
    isLoading: resolving,
    needsCreation,
    legacyStore,
    createStoreMaster,
    isCreating,
  } = useStoreMasterResolver(storeId);

  // Load note text when editing
  useEffect(() => {
    if (editingNote) {
      setNoteText(editingNote.note_text);
    } else {
      setNoteText('');
    }
  }, [editingNote, open]);

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    // If editing, update the note directly
    if (editingNote) {
      await updateNote();
      return;
    }

    // Check if we have a valid store_master.id
    if (!storeMasterId) {
      if (needsCreation) {
        try {
          const created = await createStoreMaster();
          // Retry with the newly created store_master.id
          await saveNote(created.id);
        } catch (error: any) {
          toast.error('Failed to create store master: ' + error.message);
        }
      } else {
        toast.error('Store not linked to store master. Please try again.');
      }
      return;
    }

    await saveNote(storeMasterId);
  };

  const saveNote = async (masterId: string) => {
    setSaving(true);
    try {
      const now = new Date();
      const { error } = await supabase
        .from('store_notes')
        .insert({
          store_id: masterId,
          note_text: noteText.trim(),
          created_by: user?.id,
        });

      if (error) throw error;

      const formattedDateTime = format(now, 'MMM d, yyyy h:mm a');
      toast.success(`Note added at ${formattedDateTime}`, {
        description: 'Your note has been saved with date and time',
      });
      setNoteText('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateNote = async () => {
    if (!editingNote) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_notes')
        .update({
          note_text: noteText.trim(),
        })
        .eq('id', editingNote.id);

      if (error) throw error;

      toast.success('Note updated successfully');
      setNoteText('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingNote ? 'Edit Note' : 'Add Note'} for {storeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {resolving && (
            <div className="text-center py-2 text-sm text-muted-foreground">
              Resolving store...
            </div>
          )}
          {/* {needsCreation && !resolving && (
            <div className="text-center py-2 text-sm text-yellow-600">
              Store master record will be created automatically
            </div>
          )} */}
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note here..."
              rows={5}
              className="resize-none"
            />
          </div>
          {/* <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t">
            <Clock className="h-3 w-3" />
            <span>Date and time will be saved automatically: {format(new Date(), 'MMM d, yyyy h:mm a')}</span>
          </div> */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saving || !noteText.trim() || resolving || isCreating}
          >
            {saving ? 'Saving...' : isCreating ? 'Creating...' : editingNote ? 'Update Note' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}