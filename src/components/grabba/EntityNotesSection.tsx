import React, { useState } from 'react';
import { format } from 'date-fns';
import { dynastyDateTime } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntityNotes } from '@/hooks/useEntityNotes';
import { 
  StickyNote, Plus, Pin, PinOff, Trash2, Edit, Save, X, 
  MessageSquare
} from 'lucide-react';

type EntityType = 'ambassador' | 'wholesaler' | 'driver' | 'company' | 'store' | 'biker';

interface EntityNotesSectionProps {
  entityType: EntityType;
  entityId: string | undefined;
  entityName?: string;
}

export function EntityNotesSection({ entityType, entityId, entityName }: EntityNotesSectionProps) {
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
  } = useEntityNotes(entityType, entityId);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <StickyNote className="h-5 w-5" /> Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <StickyNote className="h-5 w-5 text-primary" /> 
          Notes {entityName && <span className="text-muted-foreground font-normal">for {entityName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Section */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px]"
          />
          <Button 
            onClick={handleAddNote} 
            disabled={!newNote.trim() || isAdding}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isAdding ? 'Saving...' : 'Add Note'}
          </Button>
        </div>

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No notes yet. Add your first note above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-lg border ${
                  note.is_pinned ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                }`}
              >
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleSaveEdit}
                        disabled={isUpdating}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{note.note_text}</p>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleTogglePin(note.id, note.is_pinned)}
                        >
                          {note.is_pinned ? (
                            <PinOff className="h-4 w-4 text-primary" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleEditNote(note.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      {note.is_pinned && (
                        <Badge variant="outline" className="text-xs">Pinned</Badge>
                      )}
                      <span>{note.creator_name}</span>
                      <span>•</span>
                      <span>{dynastyDateTime(note.created_at)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
