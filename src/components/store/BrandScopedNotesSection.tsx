/**
 * BrandScopedNotesSection — Brand-aware notes for Store Profiles
 * Shows General + 4 brand-specific note tabs.
 *
 * READS: v_store_notes_clean (canonical clean view) — grouped by observed_on
 * (display date), newest first. Each note shows written_on (grey), a category
 * chip, and a warning icon when date_confidence != 'explicit' (date inferred).
 * brand_scope / author are merged from store_notes by id (the view does not
 * carry them).
 */
import { useState } from 'react';
import { NoteContentDisplay } from './NoteContentDisplay';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Plus, User, Clock, Pencil, Trash2, Upload, Eraser, AlertTriangle, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AddNoteModal } from './AddNoteModal';
import { useStoreMasterResolver } from '@/hooks/useStoreMasterResolver';
import { toast } from 'sonner';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BulkNotesUploader } from '@/components/admin/BulkNotesUploader';

// Brand config — derived from canonical registry
import { CANONICAL_BRANDS, CANONICAL_BRAND_IDS, type CanonicalBrandId } from '@/config/brands';

export const BRAND_SCOPES: ReadonlyArray<{ key: string | null; label: string; color: string; icon: string }> = [
  { key: null, label: 'General', color: 'bg-muted text-muted-foreground', icon: '📋' },
  ...CANONICAL_BRAND_IDS.map(id => ({
    key: id as string | null,
    label: CANONICAL_BRANDS[id].displayName,
    color: `${CANONICAL_BRANDS[id].softBgClass} ${CANONICAL_BRANDS[id].textClass}`,
    icon: CANONICAL_BRANDS[id].icon,
  })),
];

export type BrandScopeKey = string | null;

const getSourceFromRole = (role?: string | null): string => {
  if (!role) return 'System';
  const r = role.toLowerCase();
  if (r.includes('va')) return 'VA';
  if (r === 'biker' || r === 'driver') return 'Biker';
  if (r === 'admin' || r === 'owner') return 'Admin';
  if (r.includes('ai')) return 'AI';
  return 'User';
};

/** Row shape from v_store_notes_clean, plus brand/author merged from store_notes */
interface CleanStoreNote {
  id: string;
  store_id: string;
  observed_on: string | null;
  date_confidence: string | null;
  written_on: string | null;
  source: string | null;
  edited_at: string | null;
  edited_by: string | null;
  category: string | null;
  note_text: string;
  raw_note: string | null;
  brand_scope: string | null;
  profile?: { name: string; role?: string } | null;
}

interface BrandScopedNotesSectionProps {
  storeId: string;
  storeName: string;
}

const formatDay = (d: string | null) =>
  d ? format(parseISO(d), 'MMM d, yyyy') : '—';

const formatGroupHeader = (d: string | null) =>
  d ? format(parseISO(d), 'EEEE, MMMM d, yyyy') : 'Undated';

export function BrandScopedNotesSection({ storeId, storeName }: BrandScopedNotesSectionProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<CleanStoreNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<CleanStoreNote | null>(null);
  const [bulkUploaderOpen, setBulkUploaderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [defaultBrandScope, setDefaultBrandScope] = useState<BrandScopeKey>(null);
  const queryClient = useQueryClient();

  const { storeMasterId, isLoading: resolving } = useStoreMasterResolver(storeId);

  // Fetch clean view (canonical dates/categories) + brand_scope/author meta
  // from store_notes, merged client-side by id.
  const { data: allNotes, isLoading } = useQuery({
    queryKey: ['store-notes', storeMasterId],
    queryFn: async () => {
      if (!storeMasterId) return [];
      const [cleanRes, metaRes] = await Promise.all([
        (supabase as any)
          .from('v_store_notes_clean')
          .select('id, store_id, observed_on, date_confidence, written_on, source, edited_at, edited_by, category, note_text, raw_note')
          .eq('store_id', storeMasterId),
        supabase
          .from('store_notes')
          .select('id, brand_scope, created_by, profile:profiles(name, role)')
          .eq('store_id', storeMasterId)
          .is('deleted_at', null),
      ]);
      if (cleanRes.error) throw cleanRes.error;
      if (metaRes.error) throw metaRes.error;

      const metaById = new Map<string, any>((metaRes.data || []).map((m: any) => [m.id, m]));
      const rows = ((cleanRes.data || []) as any[]).map((n) => ({
        ...n,
        brand_scope: metaById.get(n.id)?.brand_scope ?? null,
        profile: metaById.get(n.id)?.profile ?? null,
      })) as CleanStoreNote[];

      // Newest observed_on first; undated notes sink to the bottom.
      rows.sort((a, b) => (b.observed_on || '').localeCompare(a.observed_on || ''));
      return rows;
    },
    enabled: !!storeMasterId,
  });

  // Delete mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      // Soft delete — the row is retained for audit, only hidden from readers.
      await verifiedUpdate('Delete note', () =>
        supabase
          .from('store_notes')
          .update({ deleted_at: new Date().toISOString() } as never)
          .eq('id', noteId)
          .is('deleted_at', null)
          .select('id') as never,
      );
    },
    onSuccess: () => {
      toast.success('Note deleted');
      queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(mutationErrorMessage(error));
    },
  });

  // Deduplicate notes for this store (server-side, tested function)
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      if (!storeMasterId) throw new Error('Store not resolved');
      const { data, error } = await (supabase as any).rpc('dedupe_store_notes', {
        p_store_id: storeMasterId,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    onSuccess: (removed) => {
      toast.success(
        removed > 0
          ? `Removed ${removed} duplicate note${removed === 1 ? '' : 's'}`
          : 'No duplicate notes found',
      );
      queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
    },
    onError: (error: Error) => {
      toast.error(`Cleanup failed: ${error.message}`);
    },
  });

  const handleNoteAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['store-notes', storeMasterId] });
    setEditingNote(null);
  };

  const handleAddNote = (brandScope: BrandScopeKey) => {
    setDefaultBrandScope(brandScope);
    setEditingNote(null);
    setAddModalOpen(true);
  };

  const handleEditNote = (note: CleanStoreNote) => {
    setEditingNote(note);
    setDefaultBrandScope(note.brand_scope as BrandScopeKey);
    setAddModalOpen(true);
  };

  const handleDeleteNote = (note: CleanStoreNote) => {
    setNoteToDelete(note);
    setDeleteDialogOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setAddModalOpen(open);
    if (!open) setEditingNote(null);
  };

  // Count notes per brand
  const countByBrand = (key: BrandScopeKey) =>
    allNotes?.filter((n) => (key === null ? n.brand_scope === null : n.brand_scope === key)).length ?? 0;

  const totalCount = allNotes?.length ?? 0;

  // Filter notes by active tab — already sorted newest-first by observed_on
  const filteredNotes =
    activeTab === 'all'
      ? allNotes
      : allNotes?.filter((n) =>
          activeTab === 'general'
            ? n.brand_scope === null
            : n.brand_scope === activeTab
        );

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
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            NOTES
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-base px-2 py-1">
                {totalCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="lg"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending || !storeMasterId}
              className="text-base h-11"
              title="Remove duplicate notes for this store"
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Eraser className="h-5 w-5 mr-2" />
              )}
              Clean up notes
            </Button>
            <Button variant="outline" size="lg" onClick={() => setBulkUploaderOpen(true)} className="text-base h-11">
              <Upload className="h-5 w-5 mr-2" />
              Bulk Upload
            </Button>
            <Button
              size="lg"
              onClick={() => {
                // Pre-select brand scope based on current tab
                const scope =
                  activeTab === 'all' || activeTab === 'general'
                    ? null
                    : (activeTab as BrandScopeKey);
                handleAddNote(scope);
              }}
              className="text-base h-11"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Note
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Brand Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
              <TabsTrigger value="all" className="gap-1.5 text-sm">
                All
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {totalCount}
                </Badge>
              </TabsTrigger>
              {BRAND_SCOPES.map((brand) => {
                const tabKey = brand.key === null ? 'general' : brand.key;
                const count = countByBrand(brand.key);
                return (
                  <TabsTrigger key={tabKey} value={tabKey} className="gap-1.5 text-sm">
                    <span>{brand.icon}</span>
                    {brand.label}
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {count}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* All tab and brand-specific tabs share the same renderer */}
            {['all', 'general', ...CANONICAL_BRAND_IDS].map((tabKey) => (
              <TabsContent key={tabKey} value={tabKey}>
                <NotesList
                  notes={filteredNotes}
                  onEdit={handleEditNote}
                  onDelete={handleDeleteNote}
                  emptyLabel={
                    tabKey === 'all'
                      ? 'No notes yet'
                      : tabKey === 'general'
                      ? 'No general store notes yet'
                      : `No ${BRAND_SCOPES.find((b) => b.key === tabKey)?.label || tabKey} notes yet`
                  }
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <AddNoteModal
        open={addModalOpen}
        onOpenChange={handleModalClose}
        storeId={storeId}
        storeName={storeName}
        onSuccess={handleNoteAdded}
        editingNote={editingNote}
        defaultBrandScope={defaultBrandScope}
      />

      {/* Delete Dialog */}
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
              onClick={() => noteToDelete && deleteNoteMutation.mutate(noteToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteNoteMutation.isPending}
            >
              {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Uploader */}
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

/** Group consecutive (already sorted) notes by observed_on date. */
function groupByObservedOn(notes: CleanStoreNote[]): { date: string | null; notes: CleanStoreNote[] }[] {
  const groups: { date: string | null; notes: CleanStoreNote[] }[] = [];
  for (const n of notes) {
    const last = groups[groups.length - 1];
    if (last && last.date === n.observed_on) {
      last.notes.push(n);
    } else {
      groups.push({ date: n.observed_on, notes: [n] });
    }
  }
  return groups;
}

/** Renders notes grouped by observed_on (display date), newest group first */
function NotesList({
  notes,
  onEdit,
  onDelete,
  emptyLabel,
}: {
  notes: CleanStoreNote[] | undefined;
  onEdit: (n: CleanStoreNote) => void;
  onDelete: (n: CleanStoreNote) => void;
  emptyLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? notes : notes?.slice(0, 8);

  if (!notes || notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-base">{emptyLabel}</p>
        <p className="text-sm mt-1">Add a note to keep track of important information</p>
      </div>
    );
  }

  const groups = groupByObservedOn(displayed || []);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.date ?? 'undated'} className="space-y-3">
          {/* Date header — the observed (display) date */}
          <div className="flex items-center gap-2 pt-1">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-wide">
              {formatGroupHeader(group.date)}
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {group.notes.map((note) => {
            const brandConfig = BRAND_SCOPES.find((b) => b.key === note.brand_scope) || BRAND_SCOPES[0];
            const inferredDate = note.date_confidence !== 'explicit';
            return (
              <div
                key={note.id}
                className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Brand badge + category chip */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={`${brandConfig.color} text-xs border-0`}>
                        {brandConfig.icon} {brandConfig.label}
                      </Badge>
                      {note.category && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {note.category}
                        </Badge>
                      )}
                    </div>
                    <NoteContentDisplay content={note.note_text} asHtml collapsedLines={4} className="text-base" />
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="lg" className="h-10 w-10 p-0" onClick={() => onEdit(note)} title="Edit note">
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(note)}
                      title="Delete note"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-border/20 flex-wrap">
                  {/* written_on — the date the note text was actually written */}
                  <span className="text-xs text-muted-foreground">
                    Written {formatDay(note.written_on)}
                  </span>
                  {inferredDate && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-amber-500"
                      title="Date was inferred, not explicitly stated in the note"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      date inferred
                    </span>
                  )}
                  {note.edited_at && (
                    <span
                      className="text-xs italic text-muted-foreground"
                      title={note.edited_by ? `Edited by ${note.edited_by}` : 'Edited'}
                    >
                      (edited)
                    </span>
                  )}
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
            );
          })}
        </div>
      ))}
      {notes.length > 8 && (
        <Button variant="ghost" size="lg" className="w-full text-base h-12" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show Less' : `View All ${notes.length} Notes`}
        </Button>
      )}
    </div>
  );
}
