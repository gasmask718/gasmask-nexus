import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Voicemail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useDCBusinesses } from '@/hooks/useDCBusinesses';

interface TemplateRow {
  id: string;
  name: string;
  business_unit_key: string;
  audio_url: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  voice_talent: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: '',
  business_unit_key: '',
  audio_url: '',
  transcript: '',
  duration_seconds: '',
  voice_talent: '',
  language: 'en',
};

export default function DCVoicemailTemplates() {
  const qc = useQueryClient();
  const { data: businesses = [] } = useDCBusinesses();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['dc-voicemail-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dc_voicemail_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TemplateRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required');
      if (!form.business_unit_key) throw new Error('Business unit is required');
      const payload: any = {
        name: form.name.trim(),
        business_unit_key: form.business_unit_key,
        audio_url: form.audio_url.trim() || null,
        transcript: form.transcript.trim() || null,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
        voice_talent: form.voice_talent.trim() || null,
        language: form.language || 'en',
        is_active: true,
      };
      const { error } = await (supabase as any).from('dc_voicemail_templates').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Template created');
      setForm(emptyForm);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['dc-voicemail-templates'] });
    },
    onError: (e: any) => toast.error(`Create failed: ${e.message}`),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('dc_voicemail_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dc-voicemail-templates'] }),
    onError: (e: any) => toast.error(`Update failed: ${e.message}`),
  });

  const bizLabel = (k: string) => businesses.find((b) => b.business_key === k)?.name || k;
  const bizColor = (k: string) => businesses.find((b) => b.business_key === k)?.color || 'bg-muted';

  const transcriptEmpty = !form.transcript.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Voicemail className="h-5 w-5" /> Voicemail Templates
          </h2>
          <p className="text-xs text-muted-foreground">
            TTS scripts played when AMD detects an answering machine. Audio URL is archival only — Bland uses the transcript.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Voicemail Template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. DD Reactivation VM" />
              </div>
              <div>
                <Label>Business Unit *</Label>
                <Select value={form.business_unit_key} onValueChange={(v) => setForm((f) => ({ ...f, business_unit_key: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select business unit" /></SelectTrigger>
                  <SelectContent>
                    {businesses.map((b) => (
                      <SelectItem key={b.business_key} value={b.business_key}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Archive audio URL (optional)</Label>
                <Input value={form.audio_url} onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value }))} placeholder="https://…/vm.mp3" />
              </div>
              <div>
                <Label>Transcript (required for live VM drop)</Label>
                <Textarea
                  rows={4}
                  value={form.transcript}
                  onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
                  placeholder="Hi, this is Sarah calling from Dynasty Recovery about your surplus funds…"
                />
                {transcriptEmpty && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded p-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>No transcript provided — this template cannot be used for live voicemail drop. Add a transcript to enable Bland TTS voicemail.</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duration (seconds)</Label>
                  <Input type="number" value={form.duration_seconds} onChange={(e) => setForm((f) => ({ ...f, duration_seconds: e.target.value }))} placeholder="e.g. 22" />
                </div>
                <div>
                  <Label>Voice talent</Label>
                  <Input value={form.voice_talent} onChange={(e) => setForm((f) => ({ ...f, voice_talent: e.target.value }))} placeholder="e.g. June" />
                </div>
              </div>
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending ? 'Saving…' : 'Save Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No voicemail templates yet. Click "Add Template" to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Business</th>
                    <th className="text-left p-3">Transcript preview</th>
                    <th className="text-left p-3">Duration</th>
                    <th className="text-left p-3">Voice</th>
                    <th className="text-left p-3">Lang</th>
                    <th className="text-left p-3">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => {
                    const preview = (t.transcript || '').trim();
                    const truncated = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{t.name}</td>
                        <td className="p-3">
                          <Badge className={`${bizColor(t.business_unit_key)} text-white text-xs`}>
                            {bizLabel(t.business_unit_key)}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs">
                          {truncated || <span className="italic text-amber-600">no transcript</span>}
                        </td>
                        <td className="p-3">{t.duration_seconds ? `${t.duration_seconds}s` : '—'}</td>
                        <td className="p-3">{t.voice_talent || '—'}</td>
                        <td className="p-3"><Badge variant="outline" className="uppercase text-xs">{t.language}</Badge></td>
                        <td className="p-3">
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={(v) => toggleMut.mutate({ id: t.id, is_active: v })}
                            disabled={toggleMut.isPending}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
