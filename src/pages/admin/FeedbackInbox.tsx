/**
 * FeedbackInbox — Staff-only inbox for all field feedback submissions.
 * Filterable, status-updatable, with admin notes.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Inbox, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = ['new', 'reviewing', 'in_progress', 'resolved', 'wont_fix'];
const TYPE_OPTIONS = ['bug', 'not_working', 'suggestion', 'other'];
const ROLE_OPTIONS = ['ambassador', 'driver', 'biker', 'other'];
const SEV_OPTIONS = ['low', 'medium', 'high'];

const STATUS_LABEL: Record<string, string> = {
  new: 'New', reviewing: 'Reviewing', in_progress: 'In progress', resolved: 'Resolved', wont_fix: "Won't fix",
};

export default function FeedbackInbox() {
  const qc = useQueryClient();
  const [fStatus, setFStatus] = useState<string>('all');
  const [fType, setFType] = useState<string>('all');
  const [fRole, setFRole] = useState<string>('all');
  const [fSev, setFSev] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState('new');
  const [editNotes, setEditNotes] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['feedback_submissions', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_submissions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return items.filter((it: any) => {
      if (fStatus !== 'all' && it.status !== fStatus) return false;
      if (fType !== 'all' && it.type !== fType) return false;
      if (fRole !== 'all' && it.submitter_role !== fRole) return false;
      if (fSev !== 'all' && it.severity !== fSev) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(it.title?.toLowerCase().includes(s) || it.description?.toLowerCase().includes(s) || it.page_context?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [items, fStatus, fType, fRole, fSev, search]);

  const newCount = items.filter((i: any) => i.status === 'new').length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const patch: any = { status: editStatus, admin_notes: editNotes || null };
      if (editStatus === 'resolved' && !editing.resolved_at) patch.resolved_at = new Date().toISOString();
      const { error } = await supabase
        .from('feedback_submissions')
        .update(patch)
        .eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['feedback_submissions'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  function openEdit(it: any) {
    setEditing(it);
    setEditStatus(it.status);
    setEditNotes(it.admin_notes || '');
  }

  return (
    <Layout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Inbox className="h-6 w-6" /> Feedback Inbox
              {newCount > 0 && <Badge variant="destructive">{newCount} new</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">Bug reports, suggestions, and issues from the field.</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
            <Input placeholder="Search title, description, page…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fRole} onValueChange={setFRole}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fSev} onValueChange={setFSev}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEV_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No matching submissions.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((it: any) => (
              <Card key={it.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openEdit(it)}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{it.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {it.submitter_role} · {it.type}
                        {it.severity && <> · <span className="font-medium">{it.severity}</span></>}
                        {' · '}
                        <span className="font-mono">{it.page_context || '—'}</span>
                        {' · '}
                        {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={it.status === 'new' ? 'destructive' : it.status === 'resolved' ? 'default' : 'secondary'}>
                      {STATUS_LABEL[it.status] || it.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm line-clamp-2">{it.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.title}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {editing.submitter_role} · {editing.type} · {editing.page_context || '—'}
                </p>
                <div className="p-3 rounded bg-muted text-sm whitespace-pre-wrap">{editing.description}</div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Admin notes (visible to submitter)</label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
