import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, PhoneCall, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function VONumbers() {
  const queryClient = useQueryClient();
  const [testingNumber, setTestingNumber] = useState<string | null>(null);

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['vo-phone-numbers'],
    queryFn: async () => {
      const { data } = await supabase.from('business_phone_numbers').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['vo-agents'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('elevenlabs_agents').select('*').order('sort_order');
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['vo-assignments'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('voice_ops_number_assignments').select('*');
      return data || [];
    },
  });

  const assignAgent = useMutation({
    mutationFn: async ({ phoneNumberId, agentId }: { phoneNumberId: string; agentId: string | null }) => {
      const existing = assignments.find((a: any) => a.phone_number_id === phoneNumberId);
      if (existing) {
        const { error } = await (supabase as any)
          .from('voice_ops_number_assignments')
          .update({ agent_id: agentId, status: agentId ? 'connected' : 'unassigned', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('voice_ops_number_assignments')
          .insert({ phone_number_id: phoneNumberId, agent_id: agentId, status: agentId ? 'connected' : 'unassigned' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Agent assignment updated');
      queryClient.invalidateQueries({ queryKey: ['vo-assignments'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testCall = async (phoneNumber: string) => {
    setTestingNumber(phoneNumber);
    try {
      const { error } = await supabase.functions.invoke('test-ring', { body: { phone_number: phoneNumber } });
      if (error) throw error;
      toast.success(`Test call initiated to ${phoneNumber}`);
    } catch (e: any) {
      toast.error(e.message || 'Test call failed');
    } finally {
      setTestingNumber(null);
    }
  };

  const getAssignment = (phoneId: string) => assignments.find((a: any) => a.phone_number_id === phoneId);
  const getAgent = (agentId: string) => agents.find((a: any) => a.id === agentId);

  const statusBadge = (status?: string) => {
    if (status === 'connected') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">Connected</Badge>;
    if (status === 'fallback') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500">Fallback</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground">Unassigned</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Phone className="h-6 w-6" /> Phone Number Management</h1>
        <p className="text-sm text-muted-foreground">Assign ElevenLabs agents to Twilio phone numbers</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>ElevenLabs Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((num: any) => {
                const assignment = getAssignment(num.id);
                const assignedAgent = assignment?.agent_id ? getAgent(assignment.agent_id) : null;
                const isGasMask = num.phone_number === '+18484004179';

                return (
                  <TableRow key={num.id}>
                    <TableCell className="font-mono text-sm">{num.phone_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{isGasMask ? 'GasMask' : (num.label || 'Dynasty Connect')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={assignment?.agent_id || 'none'}
                        onValueChange={(val) => assignAgent.mutate({ phoneNumberId: num.id, agentId: val === 'none' ? null : val })}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {agents.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.agent_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{statusBadge(assignment?.status)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={testingNumber === num.phone_number}
                        onClick={() => testCall(num.phone_number)}
                      >
                        {testingNumber === num.phone_number ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3 mr-1" />}
                        Test Call
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {phoneNumbers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No phone numbers imported yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
