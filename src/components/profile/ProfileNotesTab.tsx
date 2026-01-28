/**
 * ProfileNotesTab - Shared notes & activity log component for all profiles
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, Pin, Trash2, Edit2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ProfileNote {
  id: string;
  note_text: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  creator_name?: string;
}

interface ProfileNotesTabProps {
  notes: ProfileNote[];
  isLoading?: boolean;
  onAddNote: (text: string) => Promise<void>;
  onUpdateNote?: (noteId: string, text: string) => Promise<void>;
  onTogglePin?: (noteId: string, isPinned: boolean) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  isAdding?: boolean;
  entityName: string;
}

export function ProfileNotesTab({
  notes,
  isLoading,
  onAddNote,
  onUpdateNote,
  onTogglePin,
  onDeleteNote,
  isAdding,
  entityName,
}: ProfileNotesTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<ProfileNote | null>(null);
  const [noteText, setNoteText] = useState('');

  const handleAdd = async () => {
    if (!noteText.trim()) return;
    await onAddNote(noteText);
    setNoteText('');
    setIsAddDialogOpen(false);
  };

  const handleEdit = async () => {
    if (!editingNote || !noteText.trim() || !onUpdateNote) return;
    await onUpdateNote(editingNote.id, noteText);
    setNoteText('');
    setEditingNote(null);
    setIsEditDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteNoteId || !onDeleteNote) return;
    await onDeleteNote(deleteNoteId);
    setDeleteNoteId(null);
  };

  const openEditDialog = (note: ProfileNote) => {
    setEditingNote(note);
    setNoteText(note.note_text);
    setIsEditDialogOpen(true);
  };

  // Sort: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notes & Activity</CardTitle>
            <CardDescription>Communication history and notes for {entityName}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Note
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {sortedNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No notes yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add First Note
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 rounded-lg border ${
                      note.is_pinned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{note.creator_name || 'Unknown'}</span>
                        {note.is_pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {onTogglePin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onTogglePin(note.id, !note.is_pinned)}
                          >
                            <Pin
                              className={`h-3.5 w-3.5 ${
                                note.is_pinned ? 'text-primary fill-primary' : ''
                              }`}
                            />
                          </Button>
                        )}
                        {onUpdateNote && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(note)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onDeleteNote && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteNoteId(note.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note for {entityName}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter your note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isAdding || !noteText.trim()}>
              {isAdding ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter your note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!noteText.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ProfileNotesTab;
