import { useState } from 'react';
import { Lightbulb, Search, Trash2, Loader2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { fieldStamp } from '@/lib/dates';
import { mutationErrorMessage } from '@/lib/verifiedMutation';
import { IdeaSubmitDialog } from '@/components/idea/IdeaSubmitDialog';
import { IdeaInternalNotes } from '@/components/idea/IdeaInternalNotes';
import { IdeaAttachmentLightbox } from '@/components/idea/IdeaAttachmentLightbox';
import { IdeaDetailSheet } from '@/components/idea/IdeaDetailSheet';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import {
  DEFAULT_IDEA_FILTERS,
  IDEA_CATEGORIES,
  IDEA_PRIORITIES,
  IDEA_STATUSES,
  useDeleteIdea,
  useIdeaSubmissions,
  useUpdateIdea,
  type IdeaAttachment,
  type IdeaFilters,
  type IdeaStatus,
  type IdeaSubmission,
} from '@/hooks/useIdeaBox';

const ALL = '__all__';

const statusVariant: Record<IdeaStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  new: 'default',
  triaged: 'secondary',
  planned: 'secondary',
  in_progress: 'default',
  shipped: 'outline',
  declined: 'destructive',
};

export default function IdeaDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filters, setFilters] = useState<IdeaFilters>(DEFAULT_IDEA_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailIdea, setDetailIdea] = useState<IdeaSubmission | null>(null);
  const [lightbox, setLightbox] = useState<{
    attachments: IdeaAttachment[];
    index: number;
    title: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IdeaSubmission | null>(null);

  const { data, isLoading, error } = useIdeaSubmissions(filters);
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));

  const patch = (next: Partial<IdeaFilters>) =>
    setFilters((f) => ({ ...f, page: 0, ...next }));

  const setStatus = async (id: string, status: IdeaStatus) => {
    try {
      await updateIdea.mutateAsync({ id, patch: { status } });
      toast({ title: 'Status updated' });
    } catch (e) {
      toast({
        title: 'Update failed',
        description: mutationErrorMessage(e),
        variant: 'destructive',
        duration: 8000,
      });
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteIdea.mutateAsync(id);
      toast({ title: 'Idea deleted' });
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: mutationErrorMessage(e),
        variant: 'destructive',
        duration: 8000,
      });
      throw e;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Lightbulb className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Idea &amp; Improvement Box</h1>
            <p className="text-sm text-muted-foreground">
              Everything the team has flagged, with the page and photos they captured.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{total} submitted</Badge>
          <Button size="sm" onClick={() => setSubmitOpen(true)}>
            <Lightbulb className="mr-2 h-4 w-4" />
            Submit idea
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Title, text, submitter, page…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && patch({ search: searchDraft })}
                onBlur={() => patch({ search: searchDraft })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={filters.status || ALL}
              onValueChange={(v) => patch({ status: v === ALL ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {IDEA_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={filters.category || ALL}
              onValueChange={(v) => patch({ category: v === ALL ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {IDEA_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select
              value={filters.priority || ALL}
              onValueChange={(v) => patch({ priority: v === ALL ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All priorities</SelectItem>
                {IDEA_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Lightbulb className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No ideas yet</p>
              <p className="text-sm text-muted-foreground">
                Use the lightbulb button in the corner of any page to submit one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1120px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Idea</TableHead>
                    <TableHead className="w-[140px]">From</TableHead>
                    <TableHead className="w-[110px]">Type</TableHead>
                    <TableHead className="w-[100px]">Priority</TableHead>
                    <TableHead className="w-[160px]">Page</TableHead>
                    <TableHead className="w-[90px]">Photos</TableHead>
                    <TableHead className="w-[130px]">Submitted</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="align-top">
                        <button
                          type="button"
                          onClick={() => setDetailIdea(r)}
                          className="w-full text-left"
                        >
                          <div className="break-words font-medium leading-snug [overflow-wrap:anywhere]">
                            {r.title}
                          </div>
                          <div className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                            {r.body}
                          </div>
                          <span className="mt-1 inline-block text-[11px] text-primary hover:underline">
                            View full idea
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="align-top text-sm break-words [overflow-wrap:anywhere]">
                        {r.submitter_name || r.submitter_email || 'Unknown'}
                        {r.submitter_role && (
                          <div className="text-xs capitalize text-muted-foreground">
                            {r.submitter_role}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm capitalize">
                        {r.category.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.priority === 'blocker' || r.priority === 'high'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="capitalize"
                        >
                          {r.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] align-top">
                        {r.route_path ? (
                          <button
                            type="button"
                            onClick={() => navigate(r.route_path as string)}
                            className="flex w-full items-center gap-1 overflow-hidden font-mono text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{r.route_path}</span>
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.attachments?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.attachments.map((a, i) => (
                              <Button
                                key={a.path}
                                size="sm"
                                variant="outline"
                                aria-label={`View photo ${i + 1}`}
                                className="h-6 gap-1 px-2 text-xs"
                                onClick={() =>
                                  setLightbox({
                                    attachments: r.attachments,
                                    index: i,
                                    title: r.title,
                                  })
                                }
                              >
                                <ImageIcon className="h-3 w-3" />
                                {i + 1}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs leading-relaxed">
                        {fieldStamp(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) => setStatus(r.id, v as IdeaStatus)}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IDEA_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge
                          variant={statusVariant[r.status]}
                          className="mt-1 hidden"
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <IdeaInternalNotes ideaId={r.id} ideaTitle={r.title} />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete idea"
                          disabled={deleteIdea.isPending}
                          onClick={() => setPendingDelete(r)}
                        >
                          {deleteIdea.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filters.page * filters.pageSize + 1}–
            {Math.min((filters.page + 1) * filters.pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm tabular-nums">
              {filters.page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page + 1 >= pageCount}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <IdeaSubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} />

      <IdeaDetailSheet
        idea={detailIdea}
        open={!!detailIdea}
        onOpenChange={(o) => !o && setDetailIdea(null)}
      />

      <IdeaAttachmentLightbox
        open={!!lightbox}
        onOpenChange={(o) => !o && setLightbox(null)}
        attachments={lightbox?.attachments ?? []}
        startIndex={lightbox?.index ?? 0}
        title={lightbox?.title}
      />

      <DeleteConfirmModal
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete idea"
        itemName={pendingDelete?.title}
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete.id);
        }}
      />
    </div>
  );
}
