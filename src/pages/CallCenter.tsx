import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Phone, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const CallCenter = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [entityType, setEntityType] = useState<string>('store');
  const [entityId, setEntityId] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [fullMessage, setFullMessage] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');

  const { data: stores } = useQuery({
    queryKey: ['stores-for-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'store',
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-for-calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, name, type')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'contact',
  });

  const { data: callQueue } = useQuery({
    queryKey: ['call-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name)
        `)
        .eq('follow_up_required', true)
        .eq('channel', 'call')
        .lte('follow_up_date', new Date().toISOString())
        .order('follow_up_date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const logCallMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('communication_logs').insert([{
        channel: 'call',
        direction: 'outbound',
        summary: data.summary,
        full_message: data.fullMessage,
        outcome: data.outcome,
        follow_up_required: data.followUpRequired,
        follow_up_date: data.followUpDate || null,
        store_id: data.entityType === 'store' ? data.entityId : null,
        contact_id: data.entityType === 'contact' ? data.entityId : null,
        created_by: user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Call logged successfully');
      queryClient.invalidateQueries({ queryKey: ['call-queue'] });
      queryClient.invalidateQueries({ queryKey: ['recent-communication-logs'] });
      // Reset form
      setSummary('');
      setFullMessage('');
      setOutcome('');
      setFollowUpRequired(false);
      setFollowUpDate('');
      setEntityId('');
    },
    onError: (error) => {
      toast.error('Failed to log call: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!entityId || !summary) {
      toast.error('Please fill in all required fields');
      return;
    }

    logCallMutation.mutate({
      entityType,
      entityId,
      summary,
      fullMessage,
      outcome,
      followUpRequired,
      followUpDate: followUpRequired ? followUpDate : null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Call Center</h1>
        <p className="text-muted-foreground mt-1">
          Log and track all phone communications
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Call Logging Form */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Log New Call</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select {entityType === 'store' ? 'Store' : 'Contact'}</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Choose ${entityType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {entityType === 'store'
                      ? stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))
                      : contacts?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <Input
                placeholder="e.g., Answered, Voicemail, No Answer"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Summary *</Label>
              <Input
                placeholder="Brief summary of the call"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Call Notes</Label>
              <Textarea
                placeholder="Detailed notes about the conversation..."
                value={fullMessage}
                onChange={(e) => setFullMessage(e.target.value)}
                rows={5}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="follow-up"
                checked={followUpRequired}
                onCheckedChange={setFollowUpRequired}
              />
              <Label htmlFor="follow-up">Follow-up required</Label>
            </div>

            {followUpRequired && (
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={logCallMutation.isPending}>
              {logCallMutation.isPending ? 'Logging Call...' : 'Log Call'}
            </Button>
          </form>
        </Card>

        {/* Call Queue */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Call Queue</h2>
          </div>
          <div className="space-y-3">
            {callQueue?.map((call) => (
              <div
                key={call.id}
                className="p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
              >
                <p className="font-medium text-sm">
                  {call.contact?.name || call.store?.name || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {call.summary}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(call.follow_up_date!).toLocaleDateString()}
                </div>
              </div>
            ))}
            {(!callQueue || callQueue.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No calls in queue
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CallCenter;