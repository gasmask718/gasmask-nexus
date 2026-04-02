import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClipboardList, Flame, Clock, ExternalLink, Loader2, Plus, MapPin, Phone } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface FundingClient {
  id: string;
  first_name: string;
  last_name: string;
}

interface TaskCard {
  id: string;
  client_id: string;
  title: string;
  category: string;
  status: string;
  strategic_rationale: string | null;
  steps: Json;
  resource_url: string | null;
  resource_address: string | null;
  resource_phone: string | null;
  document_checklist: string[] | null;
  time_estimate: string | null;
  deadline: string | null;
  funding_impact: number | null;
  module: string | null;
  depends_on: string[] | null;
  completed_at: string | null;
  sort_order: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  online: 'border-l-amber-500',
  branch_visit: 'border-l-blue-500',
  mail: 'border-l-red-500',
  phone_call: 'border-l-green-500',
  document: 'border-l-purple-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  online: 'Online',
  branch_visit: 'Branch Visit',
  mail: 'Mail',
  phone_call: 'Phone Call',
  document: 'Document Prep',
};

const MODULES = ['Credit Repair', 'Business Builder', 'Bureau Intel', 'Funding Matrix', 'Velocity', 'Tradeline Vault'];

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (86400000));
}

function deadlineColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days < 3) return 'text-red-400';
  if (days <= 7) return 'text-amber-400';
  return 'text-green-400';
}

export default function TaskCardsPage() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState('all');
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Record<number, boolean>>>({});
  const [genOpen, setGenOpen] = useState(false);
  const [genClient, setGenClient] = useState('');
  const [genModule, setGenModule] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from('funding_clients').select('id, first_name, last_name').then(({ data }) => {
      if (data) setClients(data);
    });
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const { data } = await supabase.from('funding_task_cards').select('*').order('funding_impact', { ascending: false }).order('deadline', { ascending: true });
    if (data) setTasks(data as TaskCard[]);
  };

  const filteredTasks = selectedClient === 'all' ? tasks : tasks.filter(t => t.client_id === selectedClient);
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  const allPending = tasks.filter(t => t.status === 'pending');
  const dueSoon = allPending.filter(t => { const d = daysUntil(t.deadline); return d !== null && d <= 2; });
  const completedToday = tasks.filter(t => t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString());
  const avgImpact = allPending.length > 0 ? (allPending.reduce((s, t) => s + (t.funding_impact ?? 0), 0) / allPending.length).toFixed(1) : '0';

  const completeTask = async (task: TaskCard) => {
    const { error } = await supabase.from('funding_task_cards').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', task.id);
    if (error) { toast.error('Failed to complete task'); return; }
    // Unlock dependent tasks
    if (task.id) {
      await supabase.from('funding_task_cards').update({ status: 'pending' })
        .contains('depends_on', [task.id]).eq('status', 'blocked');
    }
    toast.success('Task completed');
    loadTasks();
  };

  const generateCards = async () => {
    if (!genClient || !genModule) { toast.error('Select client and module'); return; }
    setGenerating(true);
    try {
      const cl = clients.find(c => c.id === genClient);
      const { data: dfs } = await supabase.from('funding_dfs_scores')
        .select('total_score, personal_credit_tu, personal_credit_eq, personal_credit_ex')
        .eq('client_id', genClient).order('scored_at', { ascending: false }).limit(1).maybeSingle();

      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_task_cards',
          client: { id: genClient, first_name: cl?.first_name, last_name: cl?.last_name },
          scores: dfs,
          module: genModule,
        },
      });
      if (error) throw error;

      const cardsArr = data.tasks || [];
      if (Array.isArray(cardsArr) && cardsArr.length > 0) {
        for (const card of cardsArr) {
          await supabase.from('funding_task_cards').insert({
            client_id: genClient,
            title: card.title || 'Untitled Task',
            category: card.category || 'online',
            status: 'pending',
            strategic_rationale: card.rationale || null,
            steps: card.steps || [],
            resource_url: card.resource_url || null,
            resource_address: card.resource_address || null,
            document_checklist: card.document_checklist || null,
            time_estimate: card.time_estimate ? `${card.time_estimate} min` : null,
            deadline: card.deadline_days ? new Date(Date.now() + card.deadline_days * 86400000).toISOString().split('T')[0] : null,
            funding_impact: card.funding_impact || 5,
            module: genModule,
          });
        }
        toast.success(`${cardsArr.length} task cards generated`);
        loadTasks();
      } else {
        toast.info('AI returned no task cards');
      }
      setGenOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const getClientName = (id: string) => {
    const c = clients.find(x => x.id === id);
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown';
  };

  const stepsArray = (steps: Json): string[] => {
    if (Array.isArray(steps)) return steps.map(s => String(s));
    return [];
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><ClipboardList className="h-8 w-8" /> Task Cards</h1>
          <p className="text-muted-foreground">Unified action center — every pending action across all clients</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" /> Generate Task Cards</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate AI Task Cards</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <Select value={genClient} onValueChange={setGenClient}>
                    <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Module</label>
                  <Select value={genModule} onValueChange={setGenModule}>
                    <SelectTrigger><SelectValue placeholder="Select module…" /></SelectTrigger>
                    <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={generateCards} disabled={generating} className="w-full bg-amber-600 hover:bg-amber-700">
                  {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</> : 'Generate'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Pending Tasks</div><div className="text-2xl font-black text-amber-400">{allPending.length}</div></CardContent></Card>
        <Card className={dueSoon.length > 0 ? 'border-red-500/50' : ''}><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Due ≤48hrs</div><div className="text-2xl font-black text-red-400">{dueSoon.length}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Completed Today</div><div className="text-2xl font-black text-green-400">{completedToday.length}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Avg Impact</div><div className="text-2xl font-black text-amber-400">{avgImpact}</div></CardContent></Card>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length === 0 && <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">No pending tasks. Generate task cards to get started.</CardContent></Card>}
      <div className="space-y-3">
        {pendingTasks.map(task => {
          const days = daysUntil(task.deadline);
          const steps = stepsArray(task.steps);
          return (
            <Card key={task.id} className={`border-l-4 ${CATEGORY_COLORS[task.category] || 'border-l-border'}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{task.title}</span>
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[task.category] || task.category}</Badge>
                    {task.module && <Badge variant="secondary" className="text-[10px]">{task.module}</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-amber-400 text-sm"><Flame className="h-4 w-4" />{task.funding_impact ?? 0}</span>
                    {days !== null && (
                      <span className={`flex items-center gap-1 text-sm ${deadlineColor(days)}`}>
                        <Clock className="h-4 w-4" />{days}d
                      </span>
                    )}
                  </div>
                </div>
                {selectedClient === 'all' && <div className="text-xs text-muted-foreground">Client: {getClientName(task.client_id)}</div>}
                {task.strategic_rationale && <p className="text-sm italic text-muted-foreground">{task.strategic_rationale}</p>}
                {steps.length > 0 && (
                  <ol className="list-decimal list-inside space-y-1 text-sm">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                )}
                <div className="flex flex-wrap gap-3 text-xs">
                  {task.resource_url && <a href={task.resource_url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open Resource</a>}
                  {task.resource_address && <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" /> {task.resource_address}</span>}
                  {task.resource_phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {task.resource_phone}</span>}
                </div>
                {task.document_checklist && task.document_checklist.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Documents Needed:</span>
                    {task.document_checklist.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Checkbox checked={checkedDocs[task.id]?.[i] || false} onCheckedChange={v => setCheckedDocs(prev => ({ ...prev, [task.id]: { ...prev[task.id], [i]: !!v } }))} />
                        <span className="text-sm">{doc}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{task.time_estimate || 'No estimate'}</span>
                  <Button size="sm" onClick={() => completeTask(task)} className="bg-green-600 hover:bg-green-700">Mark Complete</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-2">Completed ({completedTasks.length})</h3>
          <div className="space-y-2">
            {completedTasks.slice(0, 5).map(task => (
              <Card key={task.id} className="opacity-60">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm line-through">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
