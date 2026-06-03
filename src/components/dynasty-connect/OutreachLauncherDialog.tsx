import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  businessKey: string;
  businessName: string;
  defaultFromNumber?: string;
}

type Method = 'bland' | 'sms' | 'manual';

export function OutreachLauncherDialog({
  open,
  onClose,
  businessKey,
  businessName,
  defaultFromNumber,
}: Props) {
  const [method, setMethod] = useState<Method>('bland');
  const [agentId, setAgentId] = useState<string>('');
  const [toNumber, setToNumber] = useState('+17183089391');
  const [leadName, setLeadName] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [launching, setLaunching] = useState(false);

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['dc-agents', businessKey],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_agents')
        .select('*')
        .eq('business', businessKey)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: open,
  });

  const selectedAgent = useMemo(
    () => agents.find((a: any) => a.id === agentId),
    [agents, agentId],
  );

  const handleLaunch = async () => {
    if (!toNumber.trim()) {
      toast.error('Enter a destination phone number');
      return;
    }

    setLaunching(true);
    try {
      if (method === 'bland') {
        if (!selectedAgent) {
          toast.error('Select an agent');
          setLaunching(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('dc-outbound-call', {
          body: {
            to_number: toNumber.trim(),
            lead_name: leadName.trim() || undefined,
            business: businessKey,
            agent_type: selectedAgent.agent_type,
            agent_id_override: selectedAgent.agent_id,
          },
        });
        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || 'Call failed');
        }
        toast.success(`📞 Bland call placed via ${selectedAgent.name}`, {
          description: `Call ID: ${data.call_id || 'logged'}`,
        });
        onClose();
      } else if (method === 'sms') {
        if (!messageBody.trim()) {
          toast.error('Enter a message');
          setLaunching(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: {
            to_number: toNumber.trim(),
            message_body: messageBody.trim(),
            idempotency_key: `dc-${businessKey}-${Date.now()}`,
            metadata: { business: businessKey, source: 'dc_launcher' },
          },
        });
        if (error || data?.error) {
          throw new Error(error?.message || data?.error || 'SMS failed');
        }
        toast.success('✉️ SMS sent');
        onClose();
      } else {
        // manual call — open dialer
        window.open(`tel:${toNumber.trim()}`, '_self');
        toast.success('📱 Opening dialer for manual call');
        onClose();
      }
    } catch (e: any) {
      console.error('Launch failed', e);
      toast.error(e.message || 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Outreach Launcher
            <Badge variant="outline">{businessName}</Badge>
          </DialogTitle>
          <DialogDescription>
            From {defaultFromNumber || 'business default'} · Choose method, agent, and target
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Method picker */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={method === 'bland' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('bland')}
              className="flex-col h-auto py-3"
            >
              <Phone className="h-4 w-4 mb-1" />
              <span className="text-xs">AI Call</span>
            </Button>
            <Button
              type="button"
              variant={method === 'sms' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('sms')}
              className="flex-col h-auto py-3"
            >
              <MessageSquare className="h-4 w-4 mb-1" />
              <span className="text-xs">SMS</span>
            </Button>
            <Button
              type="button"
              variant={method === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('manual')}
              className="flex-col h-auto py-3"
            >
              <UserCheck className="h-4 w-4 mb-1" />
              <span className="text-xs">Manual</span>
            </Button>
          </div>

          {method === 'bland' && (
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      agentsLoading
                        ? 'Loading agents…'
                        : agents.length === 0
                          ? 'No agents seeded for this business'
                          : 'Select agent'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{' '}
                      <span className="text-muted-foreground text-xs">
                        ({a.agent_type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgent && (
                <p className="text-xs text-muted-foreground font-mono">
                  Bland: {selectedAgent.agent_id}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>To Number</Label>
            <Input
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+1XXXXXXXXXX"
            />
          </div>

          {method === 'bland' && (
            <div className="space-y-2">
              <Label>Lead Name (optional)</Label>
              <Input
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="e.g. David"
              />
            </div>
          )}

          {method === 'sms' && (
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={4}
                placeholder="Hi {name}, this is…"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={launching}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={launching}>
            {launching && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {method === 'bland' && 'Launch Call'}
            {method === 'sms' && 'Send SMS'}
            {method === 'manual' && 'Open Dialer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
