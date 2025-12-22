import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { AddNoteModal } from './AddNoteModal';

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
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['store-notes', storeId],
    queryFn: async () => {
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
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreNote[];
    },
  });

  const handleNoteAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-notes', storeId] });
  };

  const displayedNotes = showAll ? notes : notes?.slice(0, 5);

  if (isLoading) {
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
                  className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-2"
                >
                  <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    {(note.profile as any)?.name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
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
        onOpenChange={setAddModalOpen}
        storeId={storeId}
        storeName={storeName}
        onSuccess={handleNoteAdded}
      />
    </>
  );
}