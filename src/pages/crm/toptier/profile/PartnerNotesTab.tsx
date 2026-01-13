/**
 * Partner Notes Tab - Durable, timestamped internal notes
 * Notes are persisted to crm_partner_notes and rehydrated on open.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, Edit, Trash2, Pin, User, Calendar,
  StickyNote, Loader2
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { usePartnerNotes } from '@/hooks/toptier/usePartnerNotes';
import { format } from 'date-fns';

interface PartnerNotesTabProps {
  partner: any;
  isSimulated: boolean;
}

export default function PartnerNotesTab({ partner, isSimulated }: PartnerNotesTabProps) {
  const { partnerId } = useParams();
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const {
    notes,
    isLoading,
    addNote,
    updateNote,
    togglePin,
    deleteNote,
    isAdding,
    isUpdating,
    isDeleting,
  } = usePartnerNotes(partnerId, isSimulated);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote({ noteText: newNote.trim() });
    setNewNote('');
  };

  const handleEditNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditingContent(note.note_text);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim() || !editingNoteId) return;
    await updateNote({ noteId: editingNoteId, noteText: editingContent.trim() });
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote({ noteId });
  };

  const handleTogglePin = async (noteId: string, currentlyPinned: boolean) => {
    await togglePin({ noteId, isPinned: !currentlyPinned });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Notes</h2>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-32 ml-auto" />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Notes
          {isSimulated && <SimulationBadge />}
        </h2>
      </div>

      {/* Add Note */}
      <Card>
        <CardContent className="pt-6">
          <Textarea
            placeholder="Add a note about this partner..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="mb-4"
          />
          <div className="flex justify-end">
            <Button onClick={handleAddNote} disabled={!newNote.trim() || isAdding}>
              {isAdding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {isAdding ? 'Saving...' : 'Add Note'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      {notes.length === 0 ? (
        <EmptyStateWithGuidance
          icon={StickyNote}
          title="No Notes Yet"
          description="Add internal notes to track important information about this partner."
        />
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card 
              key={note.id}
              className={note.is_pinned ? 'border-yellow-500/50 bg-yellow-500/5' : ''}
            >
              <CardContent className="p-4">
                {editingNoteId === note.id ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {isUpdating ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {note.is_pinned && (
                          <div className="flex items-center gap-1 text-yellow-600 text-xs mb-2">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {note.creator_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleTogglePin(note.id, note.is_pinned)}
                          className={note.is_pinned ? 'text-yellow-600' : ''}
                        >
                          <Pin className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditNote(note.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
