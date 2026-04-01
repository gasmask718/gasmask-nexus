import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneOutgoing, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function VOOutbound() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agentType, setAgentType] = useState<string>('sales');
  const [amdEnabled, setAmdEnabled] = useState(true);
  const [calling, setCalling] = useState(false);

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Enter a target phone number');
      return;
    }

    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('dc-outbound-call', {
        body: {
          to_number: phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`,
          agent_type: agentType,
          amd: amdEnabled,
        },
      });
      if (error) throw error;
      toast.success(`Outbound call initiated to ${phoneNumber}`, {
        description: `Agent: ${agentType} | AMD: ${amdEnabled ? 'ON' : 'OFF'}`,
      });
      setPhoneNumber('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to initiate call');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><PhoneOutgoing className="h-6 w-6" /> Cold Call Trigger</h1>
        <p className="text-sm text-muted-foreground">Initiate an outbound AI call via Dynasty Connect or GasMask agent</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Outbound Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Phone Number</Label>
            <Input
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <Label>Select Agent</Label>
            <Select value={agentType} onValueChange={setAgentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">DC Sales Agent</SelectItem>
                <SelectItem value="followup">DC Follow-Up Agent</SelectItem>
                <SelectItem value="reactivation">DC Reactivation Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm font-medium">AMD (Answering Machine Detection)</Label>
              <p className="text-xs text-muted-foreground">Skip voicemails automatically</p>
            </div>
            <Switch checked={amdEnabled} onCheckedChange={setAmdEnabled} />
          </div>

          <Button onClick={handleCall} disabled={calling} className="w-full">
            {calling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PhoneOutgoing className="h-4 w-4 mr-2" />}
            {calling ? 'Dialing...' : 'Initiate Call'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
