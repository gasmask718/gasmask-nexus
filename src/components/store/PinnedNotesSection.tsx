import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePinnedNotes } from '@/hooks/usePinnedNotes';
import { Pin, Plus, X, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PinnedNotesSectionProps {
  storeId: string;
  readOnly?: boolean;
}

export function PinnedNotesSection({ storeId, readOnly = false }: PinnedNotesSectionProps) {
  const [newNote, setNewNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { pinnedNotes, isLoading, pinNote, unpinNote, isPinning, isUnpinning } = usePinnedNotes(storeId);
  const { user } = useAuth();

  // Check if user has pin permissions (owner/admin/staff)
  const { data: canPin } = useQuery({
    queryKey: ['can-pin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      return data?.role && ['owner', 'admin', 'staff'].includes(data.role);
    },
    enabled: !!user && !readOnly,
  });

  const handlePin = async () => {
    if (!newNote.trim()) return;
    await pinNote({ noteText: newNote.trim() });
    setNewNote('');
    setShowForm(false);
  };

  if (isLoading) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (pinnedNotes.length === 0 && (readOnly || !canPin)) return null;

  return (
    <Card className="border-2 border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-amber-600" />
            <span className="font-semibold uppercase tracking-wider text-amber-700">
              📌 Pinned Notes ({pinnedNotes.length})
            </span>
          </div>
          {!readOnly && canPin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              {showForm ? 'Cancel' : 'Pin Note'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {/* Add pinned note form */}
        {showForm && !readOnly && canPin && (
          <div className="space-y-2 p-2 rounded-lg border border-amber-500/30 bg-background">
            <Textarea
              placeholder="Pin a critical note (e.g. 'Owner only pays on Fridays')..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <Button
              size="sm"
              onClick={handlePin}
              disabled={!newNote.trim() || isPinning}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Pin className="h-3 w-3 mr-1" />
              {isPinning ? 'Pinning...' : 'Pin Note'}
            </Button>
          </div>
        )}

        {/* Pinned notes list */}
        {pinnedNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No pinned notes yet.</p>
        ) : (
          pinnedNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <NoteContentDisplay content={note.note_text} collapsedLines={3} className="text-sm font-medium" />
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>Pinned by {note.pinner_name}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(note.pinned_at), { addSuffix: true })}</span>
                  {note.contact_name && (
                    <>
                      <span>·</span>
                      <Badge variant="outline" className="text-[9px] px-1">{note.contact_name}</Badge>
                    </>
                  )}
                </div>
              </div>
              {!readOnly && canPin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => unpinNote({ noteId: note.id })}
                  disabled={isUnpinning}
                  title="Unpin note"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
