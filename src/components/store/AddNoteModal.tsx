import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { extractOpportunitiesFromNote } from '@/services/opportunityExtractionService';
import { cn } from '@/lib/utils';

interface StoreNote {
  id: string;
  note_text: string;
  created_at?: string;
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
  const [noteDate, setNoteDate] = useState<Date | undefined>(new Date());
  
  // Resolve storeId to store_master.id
  const {
    storeMasterId,
    isLoading: resolving,
    needsCreation,
    legacyStore,
    createStoreMaster,
    isCreating,
  } = useStoreMasterResolver(storeId);

  // Load note text and date when editing
  useEffect(() => {
    if (editingNote) {
      setNoteText(editingNote.note_text);
      // Use the note's created_at date if available, otherwise use current date
      if (editingNote.created_at) {
        setNoteDate(new Date(editingNote.created_at));
      } else {
        setNoteDate(new Date());
      }
    } else {
      setNoteText('');
      setNoteDate(new Date());
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
      // Use selected date or current date
      const selectedDate = noteDate || new Date();
      // Set time to current time if date is in the past, or use selected date's time
      const dateToUse = new Date(selectedDate);
      if (dateToUse < new Date()) {
        // For past dates, set time to end of day (23:59:59)
        dateToUse.setHours(23, 59, 59, 999);
      }
      
      const { data: noteData, error } = await supabase
        .from('store_notes')
        .insert({
          store_id: masterId,
          note_text: noteText.trim(),
          created_by: user?.id,
          created_at: dateToUse.toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Extract opportunities from the note (async, don't block)
      if (noteData?.id) {
        extractOpportunitiesFromNote(masterId, noteData.id, noteText.trim(), storeName)
          .then((result) => {
            if (result.saved > 0) {
              toast.success(`Found ${result.saved} opportunity${result.saved > 1 ? 'ies' : ''}`, {
                description: 'Opportunities have been added automatically',
              });
            }
          })
          .catch((err) => {
            console.error('Error extracting opportunities:', err);
            // Don't show error to user, just log it
          });
      }

      const formattedDateTime = format(dateToUse, 'MMM d, yyyy h:mm a');
      toast.success(`Note added for ${formattedDateTime}`, {
        description: 'Your note has been saved with the selected date',
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
      // Use selected date or keep existing date
      const selectedDate = noteDate || new Date();
      const dateToUse = new Date(selectedDate);
      if (dateToUse < new Date()) {
        // For past dates, set time to end of day
        dateToUse.setHours(23, 59, 59, 999);
      }
      
      const { error } = await supabase
        .from('store_notes')
        .update({
          note_text: noteText.trim(),
          created_at: dateToUse.toISOString(),
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
            <Label className="text-base font-semibold">Note</Label>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter your note here..."
              rows={5}
              className="resize-none text-base"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-base h-12",
                    !noteDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-3 h-5 w-5" />
                  {noteDate ? format(noteDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={noteDate}
                  onSelect={setNoteDate}
                  initialFocus
                  className="text-base"
                />
              </PopoverContent>
            </Popover>
            <p className="text-sm text-muted-foreground">
              You can pick any date, including old dates
            </p>
          </div>
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