import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface AgentConfig {
  id: string;
  agent_name: string;
  voice_name: string;
  voice_model: string;
  llm_model: string;
  temperature: number;
  max_tokens: number;
  stability: number;
  similarity_boost: number;
  latency_optimization: number;
  agent_status: string;
  is_active: boolean;
}

export default function VOAgents() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<AgentConfig>>>({});

  const { data: agents = [] } = useQuery({
    queryKey: ['vo-agents-config'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('elevenlabs_agents').select('*').order('sort_order');
      return (data || []) as AgentConfig[];
    },
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AgentConfig> }) => {
      const { error } = await (supabase as any).from('elevenlabs_agents').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Agent settings saved');
      queryClient.invalidateQueries({ queryKey: ['vo-agents-config'] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getEdit = (agent: AgentConfig) => ({ ...agent, ...localEdits[agent.id] });

  const setField = (id: string, field: string, value: any) => {
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setEditingId(id);
  };

  const saveAgent = (id: string) => {
    const edits = localEdits[id];
    if (!edits) return;
    updateAgent.mutate({ id, updates: edits });
    setLocalEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const statusColor = (s: string) => {
    if (s === 'connected') return 'bg-green-500/10 text-green-500 border-green-500';
    if (s === 'fallback') return 'bg-red-500/10 text-red-500 border-red-500';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> ElevenLabs Agent Config</h1>
        <p className="text-sm text-muted-foreground">Configure voice model, LLM, and tuning parameters per agent</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map((agent: AgentConfig) => {
          const a = getEdit(agent);
          const isEditing = editingId === agent.id;

          return (
            <Card key={agent.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{a.agent_name}</CardTitle>
                  <Badge variant="outline" className={statusColor(a.agent_status || 'unassigned')}>
                    {a.agent_status || 'unassigned'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Voice</Label>
                    <Select value={a.voice_name || 'Adam'} onValueChange={(v) => setField(agent.id, 'voice_name', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Adam">Adam</SelectItem>
                        <SelectItem value="Rachel">Rachel</SelectItem>
                        <SelectItem value="Roger">Roger</SelectItem>
                        <SelectItem value="Sarah">Sarah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Model</Label>
                    <Select value={a.voice_model || 'eleven_turbo_v2_5'} onValueChange={(v) => setField(agent.id, 'voice_model', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eleven_turbo_v2_5">eleven_turbo_v2_5</SelectItem>
                        <SelectItem value="eleven_multilingual_v2">eleven_multilingual_v2</SelectItem>
                        <SelectItem value="eleven_monolingual_v1">eleven_monolingual_v1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">LLM</Label>
                    <Select value={a.llm_model || 'gpt-4o'} onValueChange={(v) => setField(agent.id, 'llm_model', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Max Tokens</Label>
                    <Input
                      type="number"
                      value={a.max_tokens || 1024}
                      onChange={(e) => setField(agent.id, 'max_tokens', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Temperature: {(a.temperature ?? 0.7).toFixed(2)}</Label>
                  <Slider
                    value={[a.temperature ?? 0.7]}
                    min={0} max={1} step={0.01}
                    onValueChange={([v]) => setField(agent.id, 'temperature', v)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Stability: {(a.stability ?? 0.5).toFixed(2)}</Label>
                  <Slider
                    value={[a.stability ?? 0.5]}
                    min={0} max={1} step={0.01}
                    onValueChange={([v]) => setField(agent.id, 'stability', v)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Similarity Boost: {(a.similarity_boost ?? 0.75).toFixed(2)}</Label>
                  <Slider
                    value={[a.similarity_boost ?? 0.75]}
                    min={0} max={1} step={0.01}
                    onValueChange={([v]) => setField(agent.id, 'similarity_boost', v)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Latency Optimization: {a.latency_optimization ?? 2}</Label>
                  <Slider
                    value={[a.latency_optimization ?? 2]}
                    min={1} max={4} step={1}
                    onValueChange={([v]) => setField(agent.id, 'latency_optimization', v)}
                    className="mt-1"
                  />
                </div>
              </CardContent>
              {isEditing && (
                <CardFooter>
                  <Button onClick={() => saveAgent(agent.id)} disabled={updateAgent.isPending} className="w-full">
                    {updateAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}

        {agents.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
            No agents found. Add agents in the Dynasty Connect Agent Center.
          </p>
        )}
      </div>
    </div>
  );
}
