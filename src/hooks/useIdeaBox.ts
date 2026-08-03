import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert, verifiedUpdate, verifiedDelete } from '@/lib/verifiedMutation';

export type IdeaStatus =
  | 'new'
  | 'triaged'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'declined';

export const IDEA_STATUSES: { value: IdeaStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'declined', label: 'Declined' },
];

export const IDEA_CATEGORIES = [
  'improvement',
  'bug',
  'new_feature',
  'data_quality',
  'field_ops',
  'other',
] as const;

export const IDEA_PRIORITIES = ['low', 'normal', 'high', 'blocker'] as const;

export interface IdeaAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface IdeaSubmission {
  id: string;
  submitted_by: string;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_role: string | null;
  title: string;
  body: string;
  category: string;
  priority: string;
  status: IdeaStatus;
  route_path: string | null;
  route_label: string | null;
  store_id: string | null;
  record_type: string | null;
  record_id: string | null;
  user_agent: string | null;
  viewport: string | null;
  attachments: IdeaAttachment[];
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewIdeaInput {
  title: string;
  body: string;
  category: string;
  priority: string;
  routePath?: string | null;
  routeLabel?: string | null;
  storeId?: string | null;
  recordType?: string | null;
  recordId?: string | null;
  files: File[];
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterRole?: string | null;
}

async function uploadAttachments(userId: string, files: File[]) {
  const out: IdeaAttachment[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('idea-attachments')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error) throw new Error(`Attachment upload failed: ${error.message}`);
    out.push({ path, name: file.name, size: file.size, type: file.type });
  }
  return out;
}

export function useSubmitIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewIdeaInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('You must be signed in to submit an idea.');

      const attachments = input.files.length
        ? await uploadAttachments(userId, input.files)
        : [];

      const rows = await verifiedInsert<IdeaSubmission>('Submit idea', () =>
        supabase
          .from('idea_submissions')
          .insert({
            submitted_by: userId,
            submitter_name: input.submitterName ?? null,
            submitter_email: input.submitterEmail ?? auth.user?.email ?? null,
            submitter_role: input.submitterRole ?? null,
            title: input.title.trim(),
            body: input.body.trim(),
            category: input.category,
            priority: input.priority,
            route_path: input.routePath ?? null,
            route_label: input.routeLabel ?? null,
            store_id: input.storeId ?? null,
            record_type: input.recordType ?? null,
            record_id: input.recordId ?? null,
            user_agent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            attachments: attachments as unknown as never,
          })
          .select('*') as never,
      );
      return rows[0];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-submissions'] });
    },
  });
}

export interface IdeaFilters {
  status: string;
  category: string;
  priority: string;
  search: string;
  page: number;
  pageSize: number;
}

export const DEFAULT_IDEA_FILTERS: IdeaFilters = {
  status: '',
  category: '',
  priority: '',
  search: '',
  page: 0,
  pageSize: 25,
};

export function useIdeaSubmissions(filters: IdeaFilters) {
  return useQuery({
    queryKey: ['idea-submissions', filters],
    queryFn: async () => {
      let q: any = supabase
        .from('idea_submissions')
        .select('*', { count: 'exact' });


      if (filters.status) q = q.eq('status', filters.status);
      if (filters.category) q = q.eq('category', filters.category);
      if (filters.priority) q = q.eq('priority', filters.priority);
      if (filters.search.trim()) {
        const term = `%${filters.search.trim().replace(/[%,]/g, '')}%`;
        q = q.or(
          `title.ilike.${term},body.ilike.${term},submitter_name.ilike.${term},route_path.ilike.${term}`,
        );
      }
      const from = filters.page * filters.pageSize;
      q = q.order('created_at', { ascending: false }).range(from, from + filters.pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as IdeaSubmission[], total: count ?? 0 };
    },
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<IdeaSubmission, 'status' | 'priority' | 'category' | 'resolution_note'>
      >;
    }) => {
      const next: Record<string, unknown> = { ...patch };
      if (patch.status === 'shipped' || patch.status === 'declined') {
        next.resolved_at = new Date().toISOString();
      }
      return verifiedUpdate<IdeaSubmission>('Update idea', () =>
        supabase.from('idea_submissions').update(next).eq('id', id).select('id') as never,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-submissions'] }),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      verifiedDelete('Delete idea', () =>
        supabase.from('idea_submissions').delete().eq('id', id).select('id') as never,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['idea-submissions'] }),
  });
}

/** Signed URL for a private attachment. */
export async function getIdeaAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from('idea-attachments')
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
