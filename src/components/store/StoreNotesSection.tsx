import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, User, Clock, Pencil, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { dynastyDate } from '@/lib/dates';
import { AddNoteModal } from './AddNoteModal';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { toast } from 'sonner';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BulkNotesUploader } from '@/components/admin/BulkNotesUploader';

// Helper function to determine source from role
const getSourceFromRole = (role?: string | null): string => {
  if (!role) return "System";
  const roleLower = role.toLowerCase();
  if (roleLower === 'va' || roleLower.includes('va')) return "VA";
  if (roleLower === 'biker' || roleLower === 'driver') return "Biker";
  if (roleLower === 'admin' || roleLower === 'owner') return "Admin";
  if (roleLower.includes('ai') || roleLower === 'ai') return "AI";
  return "User";
};

interface StoreNote {
  id: string;
  store_id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    name: string;
    role?: string;
  } | null;
}

interface StoreNotesSectionProps {
  storeId: string;
  storeName: string;
}

export function StoreNotesSection({ storeId, storeName }: StoreNotesSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StoreNote | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<StoreNote | null>(null);
  const [bulkUploaderOpen, setBulkUploaderOpen] = useState(false);
  const queryClient = useQueryClient();

  // Resolve storeId to store_master.id
  const { storeMasterId, isLoading: resolving } = useStoreMasterResolver(storeId);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['store-notes', storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const { data, error } = await supabase
        .from('store_notes')
        .select(`
          id,
          store_id,
          note_text,
          created_at,
          created_by,
          profile:profiles(name, role)
        `)
        .eq('store_id', storeMasterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreNote[];
    },
    enabled: !!storeMasterId,
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('store_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Note deleted');
      queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  const handleNoteAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
    setEditingNote(null);
  };

  const handleEditNote = (note: StoreNote) => {
    setEditingNote(note);
    setAddModalOpen(true);
  };

  const handleDeleteNote = (note: StoreNote) => {
    setNoteToDelete(note);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      deleteNoteMutation.mutate(noteToDelete.id);
    }
  };

  const handleModalClose = (open: boolean) => {
    setAddModalOpen(open);
    if (!open) {
      setEditingNote(null);
    }
  };

  const displayedNotes = showAll ? notes : notes?.slice(0, 5);

  if (resolving || isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            ALL NOTES
            {notes && notes.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-base px-2 py-1">{notes.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setBulkUploaderOpen(true)} className="text-base h-11">
              <Upload className="h-5 w-5 mr-2" />
              Bulk Upload
            </Button>
            <Button size="lg" onClick={() => setAddModalOpen(true)} className="text-base h-11">
              <Plus className="h-5 w-5 mr-2" />
              Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!notes || notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base">No notes yet</p>
              <p className="text-sm mt-1">Add your first note to keep track of important information</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedNotes?.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex-1 min-w-0 text-base">
                      <NoteContentDisplay content={note.note_text} asHtml collapsedLines={4} className="text-base" />
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="lg"
                        className="h-10 w-10 p-0"
                        onClick={() => handleEditNote(note)}
                        title="Edit note"
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="lg"
                        className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteNote(note)}
                        title="Delete note"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{dynastyDate(note.created_at)}</span>
                      <span className="text-muted-foreground font-normal">at</span>
                      <span>{format(new Date(note.created_at), 'h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {(note.profile as any)?.name && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <User className="h-3.5 w-3.5" />
                          {(note.profile as any).name}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {getSourceFromRole((note.profile as any)?.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              
              {notes.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="lg" 
                  className="w-full text-base h-12"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `View All ${notes.length} Notes`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddNoteModal
        open={addModalOpen}
        onOpenChange={handleModalClose}
        storeId={storeId}
        storeName={storeName}
        onSuccess={handleNoteAdded}
        editingNote={editingNote}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this note. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteNoteMutation.isPending}
            >
              {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Notes Uploader Dialog */}
      <Dialog open={bulkUploaderOpen} onOpenChange={setBulkUploaderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Notes Upload</DialogTitle>
          </DialogHeader>
          <BulkNotesUploader 
            storeId={storeMasterId || storeId} 
            storeName={storeName}
            onClose={() => setBulkUploaderOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}