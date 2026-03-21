import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search, Plus, Play, Pause, MoreVertical, Copy, Trash2,
  Pencil, ArrowRight, Zap, Activity, CheckCircle2, Loader2,
  BookOpen, MessageSquare, Phone, Bot, Bell, Calendar, Clock,
  RefreshCw, CheckSquare, AlertTriangle,
} from 'lucide-react';
import {
  useCommunicationPlaybooks,
  useUpdatePlaybookMutation,
  useDeletePlaybookMutation,
  useRunPlaybookMutation,
  useCreatePlaybookMutation,
  CommunicationPlaybook,
} from '@/hooks/useCommunicationPlaybooks';
import { TRIGGER_TYPES, ACTION_TYPES } from '@/lib/playbooks/playbookConstants';
import { PlaybookBuilderSheet } from './PlaybookBuilderSheet';
import { PlaybookExecutionLog } from './PlaybookExecutionLog';

const actionIcons: Record<string, React.ReactNode> = {
  send_sms: <MessageSquare className="h-3 w-3" />,
  queue_elevenlabs_call: <Bot className="h-3 w-3" />,
  queue_auto_dialer: <Phone className="h-3 w-3" />,
  create_ai_task: <CheckSquare className="h-3 w-3" />,
  create_ai_alert: <Bell className="h-3 w-3" />,
  schedule_followup: <Calendar className="h-3 w-3" />,
  wait: <Clock className="h-3 w-3" />,
  update_lead_status: <RefreshCw className="h-3 w-3" />,
};

const actionColors: Record<string, string> = {
  send_sms: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  queue_elevenlabs_call: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  queue_auto_dialer: 'bg-green-500/15 text-green-600 border-green-500/30',
  create_ai_task: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  create_ai_alert: 'bg-red-500/15 text-red-600 border-red-500/30',
  schedule_followup: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
  wait: 'bg-muted text-muted-foreground border-border',
  update_lead_status: 'bg-muted text-muted-foreground border-border',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  paused: 'bg-amber-500/15 text-amber-600',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

export default function CommunicationPlaybooksPage() {
  const { data: playbooks, isLoading } = useCommunicationPlaybooks();
  const updateMutation = useUpdatePlaybookMutation();
  const deleteMutation = useDeletePlaybookMutation();
  const runMutation = useRunPlaybookMutation();
  const createMutation = useCreatePlaybookMutation();

  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<CommunicationPlaybook | null>(null);
  const [logPlaybookId, setLogPlaybookId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    (playbooks || []).filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.trigger_type.toLowerCase().includes(search.toLowerCase())
    ), [playbooks, search]);

  const activeCount = playbooks?.filter(p => p.status === 'active').length || 0;
  const totalRuns = playbooks?.reduce((s, p) => s + (p.run_count || 0), 0) || 0;

  const handleToggle = (pb: CommunicationPlaybook) => {
    updateMutation.mutate({
      id: pb.id,
      updates: { status: pb.status === 'active' ? 'paused' : 'active' },
    });
  };

  const handleDuplicate = (pb: CommunicationPlaybook) => {
    createMutation.mutate({
      name: `${pb.name} (copy)`,
      description: pb.description,
      status: 'draft',
      trigger_type: pb.trigger_type,
      trigger_config: pb.trigger_config,
      conditions: pb.conditions,
      actions: pb.actions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Communication Playbooks</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated workflows — trigger actions across calls, SMS, tasks, and alerts
          </p>
        </div>
        <Button onClick={() => { setEditingPlaybook(null); setBuilderOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          New Playbook
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Activity className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{playbooks?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalRuns}</p>
              <p className="text-xs text-muted-foreground">Total Runs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search playbooks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Playbook List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !filtered.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No playbooks found</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first automated workflow</p>
            <Button onClick={() => { setEditingPlaybook(null); setBuilderOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create Playbook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(pb => {
            const triggerDef = TRIGGER_TYPES.find(t => t.value === pb.trigger_type);
            const actions = pb.actions || [];

            return (
              <Card key={pb.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Name + Status */}
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{pb.name}</h3>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[pb.status] || ''}`}>
                          {pb.status}
                        </Badge>
                      </div>

                      {pb.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{pb.description}</p>
                      )}

                      {/* Trigger → Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
                          <Zap className="h-2.5 w-2.5" />
                          {triggerDef?.label || pb.trigger_type}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {actions.map((a: any, i: number) => (
                          <Badge key={i} variant="outline" className={`text-[10px] gap-1 ${actionColors[a.type] || ''}`}>
                            {actionIcons[a.type]}
                            {ACTION_TYPES.find(at => at.value === a.type)?.label || a.type}
                          </Badge>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{pb.run_count || 0} runs</span>
                        {pb.last_triggered_at && (
                          <span>Last: {new Date(pb.last_triggered_at).toLocaleDateString()}</span>
                        )}
                        {pb.last_run_result && (
                          <span className={pb.last_run_result === 'success' ? 'text-green-600' : 'text-amber-600'}>
                            {pb.last_run_result}
                          </span>
                        )}
                        <button
                          onClick={() => setLogPlaybookId(logPlaybookId === pb.id ? null : pb.id)}
                          className="underline hover:text-foreground"
                        >
                          View log
                        </button>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={pb.status === 'active'}
                        onCheckedChange={() => handleToggle(pb)}
                        className="scale-75"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => { setEditingPlaybook(pb); setBuilderOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={runMutation.isPending}
                        onClick={() => runMutation.mutate({ playbookId: pb.id })}
                      >
                        {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(pb)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(pb.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Execution Log (inline) */}
                  {logPlaybookId === pb.id && (
                    <div className="mt-3 pt-3 border-t">
                      <PlaybookExecutionLog playbookId={pb.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Builder Sheet */}
      <PlaybookBuilderSheet
        playbook={editingPlaybook}
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingPlaybook(null); }}
      />
    </div>
  );
}
