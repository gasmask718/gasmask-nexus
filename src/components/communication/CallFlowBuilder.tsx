import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GitBranch, Play, MessageCircle, HelpCircle, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

interface CallFlow {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  persona_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface CallFlowNode {
  id: string;
  flow_id: string;
  node_type: 'start' | 'message' | 'question' | 'branch' | 'end';
  content: string | null;
  expected_input: string | null;
  order_index: number;
}

interface CallFlowBuilderProps {
  businessId?: string;
}

const NODE_TYPES = [
  { value: 'start', label: 'Start', icon: Play, color: 'text-green-500' },
  { value: 'message', label: 'Message', icon: MessageCircle, color: 'text-blue-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-yellow-500' },
  { value: 'branch', label: 'Branch', icon: GitBranch, color: 'text-purple-500' },
  { value: 'end', label: 'End', icon: StopCircle, color: 'text-red-500' },
];

export default function CallFlowBuilder({ businessId }: CallFlowBuilderProps) {
  const queryClient = useQueryClient();
  const [isFlowDialogOpen, setIsFlowDialogOpen] = useState(false);
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<CallFlow | null>(null);
  const [editingFlow, setEditingFlow] = useState<CallFlow | null>(null);
  const [flowForm, setFlowForm] = useState({ name: '', description: '', persona_id: '', is_active: true });
  const [nodeForm, setNodeForm] = useState({ node_type: 'message', content: '', expected_input: '' });

  const { data: flows, isLoading } = useQuery({
    queryKey: ['call-flows', businessId],
    queryFn: async () => {
      let query = supabase.from('call_flows').select('*').order('created_at', { ascending: false });
      if (businessId) query = query.eq('business_id', businessId);
      const { data, error } = await query;
      if (error) throw error;
      return data as CallFlow[];
    }
  });

  const { data: nodes } = useQuery({
    queryKey: ['call-flow-nodes', selectedFlow?.id],
    queryFn: async () => {
      if (!selectedFlow) return [];
      const { data, error } = await supabase
        .from('call_flow_nodes')
        .select('*')
        .eq('flow_id', selectedFlow.id)
        .order('order_index');
      if (error) throw error;
      return data as CallFlowNode[];
    },
    enabled: !!selectedFlow
  });

  const { data: personas } = useQuery({
    queryKey: ['voice-personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_personas').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createFlowMutation = useMutation({
    mutationFn: async (data: typeof flowForm) => {
      const { error } = await supabase.from('call_flows').insert({
        ...data,
        business_id: businessId || null,
        persona_id: data.persona_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-flows'] });
      toast.success('Flow created');
      setIsFlowDialogOpen(false);
      setFlowForm({ name: '', description: '', persona_id: '', is_active: true });
    },
    onError: () => toast.error('Failed to create flow'),
  });

  const updateFlowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof flowForm }) => {
      const { error } = await supabase.from('call_flows').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-flows'] });
      toast.success('Flow updated');
      setIsFlowDialogOpen(false);
      setEditingFlow(null);
    },
    onError: () => toast.error('Failed to update flow'),
  });

  const deleteFlowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('call_flows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-flows'] });
      toast.success('Flow deleted');
      if (selectedFlow) setSelectedFlow(null);
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: async (data: typeof nodeForm) => {
      if (!selectedFlow) return;
      const { error } = await supabase.from('call_flow_nodes').insert({
        ...data,
        flow_id: selectedFlow.id,
        order_index: (nodes?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-flow-nodes'] });
      toast.success('Node added');
      setIsNodeDialogOpen(false);
      setNodeForm({ node_type: 'message', content: '', expected_input: '' });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('call_flow_nodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-flow-nodes'] });
      toast.success('Node removed');
    },
  });

  const handleEditFlow = (flow: CallFlow) => {
    setEditingFlow(flow);
    setFlowForm({
      name: flow.name,
      description: flow.description || '',
      persona_id: flow.persona_id || '',
      is_active: flow.is_active,
    });
    setIsFlowDialogOpen(true);
  };

  const getNodeIcon = (type: string) => {
    const nodeType = NODE_TYPES.find(n => n.value === type);
    if (!nodeType) return null;
    const Icon = nodeType.icon;
    return <Icon className={`w-4 h-4 ${nodeType.color}`} />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Call Flows
          </CardTitle>
          <Dialog open={isFlowDialogOpen} onOpenChange={setIsFlowDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setEditingFlow(null); setFlowForm({ name: '', description: '', persona_id: '', is_active: true }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Create Flow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFlow ? 'Edit Flow' : 'Create Call Flow'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Flow Name</Label>
                  <Input
                    value={flowForm.name}
                    onChange={(e) => setFlowForm({ ...flowForm, name: e.target.value })}
                    placeholder="e.g. New Store Intro"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={flowForm.description}
                    onChange={(e) => setFlowForm({ ...flowForm, description: e.target.value })}
                    placeholder="Describe what this flow does"
                  />
                </div>
                <div>
                  <Label>Voice Persona</Label>
                  <Select value={flowForm.persona_id} onValueChange={(v) => setFlowForm({ ...flowForm, persona_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select persona (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={flowForm.is_active} onCheckedChange={(v) => setFlowForm({ ...flowForm, is_active: v })} />
                </div>
                <Button
                  className="w-full"
                  onClick={() => editingFlow ? updateFlowMutation.mutate({ id: editingFlow.id, data: flowForm }) : createFlowMutation.mutate(flowForm)}
                >
                  {editingFlow ? 'Update' : 'Create'} Flow
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows?.map((flow) => (
                <TableRow
                  key={flow.id}
                  className={selectedFlow?.id === flow.id ? 'bg-muted/50' : 'cursor-pointer hover:bg-muted/30'}
                  onClick={() => setSelectedFlow(flow)}
                >
                  <TableCell className="font-medium">{flow.name}</TableCell>
                  <TableCell className="text-muted-foreground">{flow.description}</TableCell>
                  <TableCell>
                    <Badge variant={flow.is_active ? 'default' : 'secondary'}>
                      {flow.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditFlow(flow); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteFlowMutation.mutate(flow.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!flows?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No call flows created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedFlow && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Flow: {selectedFlow.name}</CardTitle>
            <Dialog open={isNodeDialogOpen} onOpenChange={setIsNodeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Node
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Flow Node</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Node Type</Label>
                    <Select value={nodeForm.node_type} onValueChange={(v) => setNodeForm({ ...nodeForm, node_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NODE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className={`w-4 h-4 ${type.color}`} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Content (What the AI says)</Label>
                    <Textarea
                      value={nodeForm.content}
                      onChange={(e) => setNodeForm({ ...nodeForm, content: e.target.value })}
                      placeholder="Enter the script for this node..."
                    />
                  </div>
                  {nodeForm.node_type === 'question' && (
                    <div>
                      <Label>Expected Input</Label>
                      <Input
                        value={nodeForm.expected_input}
                        onChange={(e) => setNodeForm({ ...nodeForm, expected_input: e.target.value })}
                        placeholder="e.g. yes/no, free-text"
                      />
                    </div>
                  )}
                  <Button className="w-full" onClick={() => createNodeMutation.mutate(nodeForm)}>
                    Add Node
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nodes?.map((node, index) => (
                <div key={node.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 min-w-24">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    {getNodeIcon(node.node_type)}
                    <Badge variant="outline" className="capitalize">{node.node_type}</Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{node.content || <span className="text-muted-foreground italic">No content</span>}</p>
                    {node.expected_input && (
                      <p className="text-xs text-muted-foreground mt-1">Expects: {node.expected_input}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteNodeMutation.mutate(node.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!nodes?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  No nodes in this flow. Add nodes to build your call script.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
