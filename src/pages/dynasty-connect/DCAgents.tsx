import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDCBusinesses } from '@/hooks/useDCBusinesses';
import { NewAgentDialog, NewBusinessDialog } from '@/components/dynasty-connect/DCAgentDialogs';

export default function DCAgents() {
  const [filter, setFilter] = useState('all');
  const [testPhone, setTestPhone] = useState('');
  const [testingAgent, setTestingAgent] = useState<any>(null);
  const [calling, setCalling] = useState(false);

  const { data: businesses = [] } = useDCBusinesses();

  const { data: agents = [] } = useQuery({
    queryKey: ['dc-agents-roster'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dc_agents').select('*').order('business, name');
      return data || [];
    },
  });

  const bizColor = useMemo(() => {
    const m: Record<string, string> = {};
    businesses.forEach((b) => { m[b.business_key] = b.color; });
    return m;
  }, [businesses]);
  const bizLabel = useMemo(() => {
    const m: Record<string, string> = {};
    businesses.forEach((b) => { m[b.business_key] = b.name; });
    return m;
  }, [businesses]);

  const filtered = filter === 'all' ? agents : agents.filter((a: any) => a.business === filter);
  const bizCounts = businesses.reduce((acc, b) => {
    acc[b.business_key] = agents.filter((a: any) => a.business === b.business_key).length;
    return acc;
  }, {} as Record<string, number>);

  const handleTestCall = async () => {
    if (!testPhone || !testingAgent) return;
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('dc-outbound-call', {
        body: { to_number: testPhone, business: testingAgent.business, agent_id_override: testingAgent.agent_id, lead_name: 'Test Call' },
      });
      if (error) throw error;
      toast.success(`📞 Test call initiated: ${data?.call_id || data?.call_sid}`);
      setTestingAgent(null);
    } catch (e: any) { toast.error(`Call failed: ${e.message}`); } finally { setCalling(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">🤖 AI Agent Roster</h1>
          <p className="text-sm text-muted-foreground">{agents.length} agents across {businesses.length} businesses</p>
        </div>
        <div className="flex gap-2">
          <NewAgentDialog />
          <NewBusinessDialog />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} className="text-xs">All {agents.length}</Button>
        {businesses.map((b) => (
          <Button key={b.business_key} size="sm" variant={filter === b.business_key ? 'default' : 'outline'} onClick={() => setFilter(b.business_key)} className="text-xs">
            {b.name} {bizCounts[b.business_key] || 0}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((agent: any) => (
          <Card key={agent.id} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${bizColor[agent.business] || 'bg-muted'}`} />
            <CardContent className="pt-5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <Badge className={`${bizColor[agent.business] || 'bg-muted'} text-white text-xs mb-1`}>{bizLabel[agent.business] || agent.business}</Badge>
                  <h3 className="font-semibold text-sm">{agent.name}</h3>
                </div>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Agent ID:</span><span className="font-mono truncate ml-2 max-w-[140px]">{agent.agent_id}</span></div>
                <div className="flex justify-between"><span>Type:</span><Badge variant="outline" className="text-xs capitalize">{agent.agent_type}</Badge></div>
                <div className="flex justify-between"><span>Total Calls:</span><span>{agent.total_calls || 0}</span></div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setTestingAgent(agent)}><Phone className="h-3 w-3 mr-1" /> Test Call</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Test {agent.name}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Phone number (+1...)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                    <Button onClick={handleTestCall} disabled={calling || !testPhone} className="w-full">{calling ? 'Calling...' : '📞 Call Now'}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
