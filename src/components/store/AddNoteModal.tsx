import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AddNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess: () => void;
}

export function AddNoteModal({ open, onOpenChange, storeId, storeName, onSuccess }: AddNoteModalProps) {
  const { user } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!storeId || storeId.trim() === '') {
      toast.error('Store ID is missing. Please try reopening this modal.');
      console.error('AddNoteModal: storeId is empty or undefined', { storeId, storeName });
      return;
    }
    
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_notes')
        .insert({
          store_id: storeId,
          note_text: noteText.trim(),
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Note added successfully');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Note for {storeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !noteText.trim()}>
            {saving ? 'Saving...' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}