import { useMemo, useState } from 'react';
import { Plus, Trash2, Save, Pencil, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useAllTrainingModules,
  useUpsertTrainingModule,
  useDeleteTrainingModule,
  type TrainingModule,
  type TrainingRole,
} from '@/components/training/useTrainingData';

const ROLES: TrainingRole[] = [
  'driver',
  'biker',
  'ambassador',
  'production',
  'office',
  'wholesaler',
];

interface FormState {
  id?: string;
  role: TrainingRole;
  title: string;
  title_es: string;
  step_order: number;
  content_md: string;
  content_md_es: string;
  video_url: string;
  is_active: boolean;
  is_first_day: boolean;
}

const empty = (role: TrainingRole): FormState => ({
  role,
  title: '',
  title_es: '',
  step_order: 0,
  content_md: '',
  content_md_es: '',
  video_url: '',
  is_active: true,
  is_first_day: false,
});

export default function TrainingAdminPage() {
  const { data: modules = [], isLoading } = useAllTrainingModules();
  const upsert = useUpsertTrainingModule();
  const del = useDeleteTrainingModule();
  const [tab, setTab] = useState<TrainingRole>('driver');
  const [editing, setEditing] = useState<FormState | null>(null);

  const grouped = useMemo(() => {
    const out: Record<string, TrainingModule[]> = {};
    for (const m of modules) (out[m.role] ??= []).push(m);
    return out;
  }, [modules]);

  const openNew = () => setEditing(empty(tab));
  const openEdit = (m: TrainingModule) =>
    setEditing({
      id: m.id,
      role: m.role,
      title: m.title,
      title_es: m.title_es ?? '',
      step_order: m.step_order,
      content_md: m.content_md,
      content_md_es: m.content_md_es ?? '',
      video_url: m.video_url ?? '',
      is_active: m.is_active,
      is_first_day: m.is_first_day,
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error('Title required');
      return;
    }
    try {
      await upsert.mutateAsync({
        ...editing,
        title_es: editing.title_es || null,
        content_md_es: editing.content_md_es || null,
        video_url: editing.video_url || null,
      } as any);
      toast.success('Saved');
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    }
  };

  const remove = async (m: TrainingModule) => {
    if (!confirm(`Delete "${m.title}"?`)) return;
    try {
      await del.mutateAsync(m.id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Training Center — Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit role SOPs that surface in every portal's ❓ menu.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> New step
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TrainingRole)}>
        <TabsList className="grid grid-cols-6 w-full">
          {ROLES.map((r) => (
            <TabsTrigger key={r} value={r} className="capitalize">
              {r}
            </TabsTrigger>
          ))}
        </TabsList>
        {ROLES.map((r) => (
          <TabsContent key={r} value={r} className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {(grouped[r] ?? []).length === 0 && !isLoading && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground text-center">
                  No modules. Click <strong>New step</strong> to add one.
                </CardContent>
              </Card>
            )}
            {(grouped[r] ?? [])
              .sort((a, b) => a.step_order - b.step_order)
              .map((m) => (
                <Card key={m.id}>
                  <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-muted-foreground">#{m.step_order}</span>
                        {m.title}
                        {m.is_first_day && (
                          <Badge variant="secondary" className="text-[10px]">
                            First-day
                          </Badge>
                        )}
                        {!m.is_active && (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(m)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                      {m.content_md}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit step' : 'New step'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(v) => setEditing({ ...editing, role: v as TrainingRole })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={editing.step_order}
                    onChange={(e) =>
                      setEditing({ ...editing, step_order: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Title (EN)</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Title (ES) — optional</Label>
                <Input
                  value={editing.title_es}
                  onChange={(e) => setEditing({ ...editing, title_es: e.target.value })}
                />
              </div>
              <div>
                <Label>Content (Markdown, EN)</Label>
                <Textarea
                  rows={8}
                  value={editing.content_md}
                  onChange={(e) => setEditing({ ...editing, content_md: e.target.value })}
                />
              </div>
              <div>
                <Label>Content (Markdown, ES) — optional</Label>
                <Textarea
                  rows={5}
                  value={editing.content_md_es}
                  onChange={(e) =>
                    setEditing({ ...editing, content_md_es: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Video URL (embed)</Label>
                <Input
                  placeholder="https://www.youtube.com/embed/..."
                  value={editing.video_url}
                  onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.is_first_day}
                    onCheckedChange={(v) => setEditing({ ...editing, is_first_day: v })}
                  />
                  First-day step
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={upsert.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
