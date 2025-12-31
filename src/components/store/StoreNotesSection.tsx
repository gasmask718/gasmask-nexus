import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, User, Clock, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { AddNoteModal } from './AddNoteModal';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';

interface StoreNote {
  id: string;
  store_id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    name: string;
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
          profile:profiles(name)
        `)
        .eq('store_id', storeMasterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreNote[];
    },
    enabled: !!storeMasterId,
  });

  const handleNoteAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
    setEditingNote(null);
  };

  const handleEditNote = (note: StoreNote) => {
    setEditingNote(note);
    setAddModalOpen(true);
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
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Notes
            {notes && notes.length > 0 && (
              <Badge variant="secondary" className="ml-2">{notes.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        </CardHeader>
        <CardContent>
          {!notes || notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notes yet</p>
              <p className="text-sm mt-1">Add your first note to keep track of important information</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedNotes?.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{note.note_text}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      onClick={() => handleEditNote(note)}
                      title="Edit note"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-border/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                      <span className="text-muted-foreground font-normal">at</span>
                      <span>{format(new Date(note.created_at), 'h:mm a')}</span>
                    </div>
                    {(note.profile as any)?.name && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                        <User className="h-3.5 w-3.5" />
                        {(note.profile as any).name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {notes.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show less' : `View all ${notes.length} notes`}
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
    </>
  );
}