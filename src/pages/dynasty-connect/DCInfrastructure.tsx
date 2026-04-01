import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Phone, Plus, CheckCircle, AlertCircle } from 'lucide-react';

const BIZ_OPTIONS = [
  { value: 'gasmask', label: 'GasMask', defaultNumber: '+18484004179' },
  { value: 'unforgettable_times', label: 'Unforgettable Times' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'surplus_funds', label: 'Surplus Funds' },
  { value: 'top_tier', label: 'Top Tier' },
  { value: 'brandaro', label: 'Brandaro' },
  { value: 'iclean', label: 'iClean' },
];

export default function DCInfrastructure() {
  const qc = useQueryClient();
  const [newBiz, setNewBiz] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newFriendly, setNewFriendly] = useState('');
  const [newAgentId, setNewAgentId] = useState('');

  const { data: phoneNumbers = [] } = useQuery({ queryKey: ['dc-phone-numbers'], queryFn: async () => { const { data } = await (supabase as any).from('dc_phone_numbers').select('*').order('created_at'); return data || []; } });
  const { data: agents = [] } = useQuery({ queryKey: ['dc-agents-phones'], queryFn: async () => { const { data } = await (supabase as any).from('dc_agents').select('agent_id, name, business'); return data || []; } });

  const addNumber = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a: any) => a.agent_id === newAgentId);
      const { error } = await (supabase as any).from('dc_phone_numbers').insert({ business: newBiz, phone_number: newNumber, friendly_name: newFriendly || `${newBiz} Line`, assigned_agent_id: newAgentId || null, assigned_agent_name: agent?.name || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dc-phone-numbers'] }); toast.success('Number added!'); setNewNumber(''); setNewFriendly(''); },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredAgents = newBiz ? agents.filter((a: any) => a.business === newBiz) : agents;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">📱 Phone Number Management</h1><p className="text-sm text-muted-foreground">Assign dedicated numbers to each business</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Setup Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Step 1:</strong> Buy numbers in Twilio Console (console.twilio.com → Buy a Number → Area code 929 or 848)</p>
          <p><strong>Step 2:</strong> Add numbers to backend secrets (UT_PHONE_NUMBER, RE_PHONE_NUMBER, SF_PHONE_NUMBER, TT_PHONE_NUMBER, BRANDARO_PHONE_NUMBER, ICLEAN_PHONE_NUMBER)</p>
          <p><strong>Step 3:</strong> Import into ElevenLabs (elevenlabs.io/app/agents/phone-numbers → Import → Twilio → Assign agent)</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Setup Status</CardTitle></CardHeader>
        <CardContent><div className="space-y-2">
          {BIZ_OPTIONS.map((biz) => {
            const existing = phoneNumbers.find((p: any) => p.business === biz.value);
            const isSetup = !!existing || !!biz.defaultNumber;
            return (
              <div key={biz.value} className="flex items-center justify-between p-2 rounded border border-border">
                <div className="flex items-center gap-2">{isSetup ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-destructive" />}<span className="font-medium text-sm">{biz.label}</span></div>
                <div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{existing?.phone_number || biz.defaultNumber || 'Not set'}</span>
                  <Badge variant="outline" className={isSetup ? 'bg-green-500/10 text-green-500 border-green-500' : 'bg-red-500/10 text-red-500 border-red-500'}>{isSetup ? '✅ Live' : '🔴 Setup needed'}</Badge>
                </div>
              </div>
            );
          })}
        </div></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Registered Numbers</CardTitle></CardHeader>
        <CardContent>{phoneNumbers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No numbers registered</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Business</th><th className="pb-2">Number</th><th className="pb-2">Agent</th><th className="pb-2">Status</th><th className="pb-2">Cost/mo</th></tr></thead><tbody>
            {phoneNumbers.map((p: any) => <tr key={p.id} className="border-b border-border/50"><td className="py-2">{p.business}</td><td className="py-2 font-mono text-xs">{p.phone_number}</td><td className="py-2">{p.assigned_agent_name || p.friendly_name || '-'}</td><td className="py-2"><Badge variant="outline" className="bg-green-500/10 text-green-500">Active</Badge></td><td className="py-2">${p.monthly_cost || '1.00'}</td></tr>)}
          </tbody></table></div>
        )}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add Number</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Business</Label><Select value={newBiz} onValueChange={setNewBiz}><SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger><SelectContent>{BIZ_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Phone Number</Label><Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="+1..." /></div>
            <div><Label>Friendly Name</Label><Input value={newFriendly} onChange={(e) => setNewFriendly(e.target.value)} placeholder="Main Line" /></div>
            <div><Label>Assigned Agent</Label><Select value={newAgentId} onValueChange={setNewAgentId}><SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger><SelectContent>{filteredAgents.map((a: any) => <SelectItem key={a.agent_id} value={a.agent_id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <Button onClick={() => addNumber.mutate()} disabled={!newBiz || !newNumber}><Phone className="h-4 w-4 mr-2" /> Add Number</Button>
        </CardContent>
      </Card>
    </div>
  );
}
