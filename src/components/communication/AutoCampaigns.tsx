import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, MessageSquare, Phone, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface AutoCampaignsProps {
  businessId?: string;
}

export default function AutoCampaigns({ businessId }: AutoCampaignsProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'sms',
    persona_id: '',
    flow_id: '',
    target_segment: 'all',
  });

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['ai-text-sequences', businessId],
    queryFn: async () => {
      let query = supabase.from('ai_text_sequences').select('*').order('created_at', { ascending: false });
      if (businessId) query = query.eq('business_id', businessId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: personas } = useQuery({
    queryKey: ['voice-personas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_personas').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: flows } = useQuery({
    queryKey: ['call-flows'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_flows').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const createCampaign = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('ai_text_sequences').insert({
        title: data.name,
        business_id: businessId || null,
        goal: data.type === 'sms' ? 'SMS Campaign' : 'Call Campaign',
        target_filter: { segment: data.target_segment },
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-text-sequences'] });
      toast.success('Campaign created');
      setIsDialogOpen(false);
      setFormData({ name: '', type: 'sms', persona_id: '', flow_id: '', target_segment: 'all' });
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const toggleCampaign = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('ai_text_sequences').update({ is_active: !isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-text-sequences'] });
      toast.success('Campaign updated');
    },
  });

  const getCampaignIcon = (goal: string | null) => {
    if (goal?.includes('Call')) return <Phone className="w-4 h-4" />;
    return <MessageSquare className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Auto Campaigns
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Auto Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Weekly Check-in"
                />
              </div>
              <div>
                <Label>Campaign Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        SMS Campaign
                      </div>
                    </SelectItem>
                    <SelectItem value="call">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        AI Call Campaign
                      </div>
                    </SelectItem>
                    <SelectItem value="both">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        SMS + Call
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type !== 'sms' && (
                <>
                  <div>
                    <Label>Voice Persona</Label>
                    <Select value={formData.persona_id} onValueChange={(v) => setFormData({ ...formData, persona_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select persona" />
                      </SelectTrigger>
                      <SelectContent>
                        {personas?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Call Flow</Label>
                    <Select value={formData.flow_id} onValueChange={(v) => setFormData({ ...formData, flow_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select call flow" />
                      </SelectTrigger>
                      <SelectContent>
                        {flows?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Target Segment</Label>
                <Select value={formData.target_segment} onValueChange={(v) => setFormData({ ...formData, target_segment: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="active">Active Stores</SelectItem>
                    <SelectItem value="inactive">Inactive 30+ Days</SelectItem>
                    <SelectItem value="new">New Stores</SelectItem>
                    <SelectItem value="high-value">High Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createCampaign.mutate(formData)}>
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences?.map((seq) => (
                <TableRow key={seq.id}>
                  <TableCell className="font-medium">{seq.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getCampaignIcon(seq.goal)}
                      <span className="text-sm">{seq.goal}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {(seq.target_filter as any)?.segment || 'All'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={seq.is_active ? 'default' : 'secondary'}>
                      {seq.is_active ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCampaign.mutate({ id: seq.id, isActive: seq.is_active || false })}
                    >
                      {seq.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!sequences?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No campaigns created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
