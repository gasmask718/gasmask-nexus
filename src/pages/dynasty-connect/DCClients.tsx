import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, DollarSign, BarChart3, FileText, Plus, Building2, Phone, Mail, Bot, Upload, Rocket, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const AGENTS = [
  { id: 'agent_0301kmdmp16aevv8svr78pbr75n8', name: 'DC — Sales Outreach' },
  { id: 'agent_3101kmdn5q9tfh7r3padaq6j37r3', name: 'DC — Follow-up' },
  { id: 'agent_5901kmdnb01sfzs9hp76mz806813', name: 'DC — Reactivation' },
  { id: 'agent_8601khrh92krfgrrdj6gqcdpwate', name: 'GasMask — Inventory Check' },
];

const PLANS = [
  { tier: 'starter', name: 'Starter', rate: 500, calls: '500 calls/mo', campaigns: '1 campaign', features: ['1 AI agent', 'Basic analytics', 'Email support'] },
  { tier: 'growth', name: 'Growth', rate: 1000, calls: '2,000 calls/mo', campaigns: '3 campaigns', features: ['2 AI agents', 'Full analytics', 'Priority support', 'Custom scripts'] },
  { tier: 'enterprise', name: 'Enterprise', rate: 2000, calls: 'Unlimited calls', campaigns: 'Unlimited campaigns', features: ['Custom agent persona', 'Dedicated number pool', 'White-glove onboarding', 'SLA guarantee', '24/7 support'] },
];

const planBadge = (tier: string | null) => {
  if (tier === 'starter') return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">Starter</Badge>;
  if (tier === 'growth') return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Growth</Badge>;
  if (tier === 'enterprise') return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">Enterprise</Badge>;
  return <Badge variant="outline">No Plan</Badge>;
};

const statusBadge = (s: string) => {
  if (s === 'active') return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Active</Badge>;
  if (s === 'onboarding') return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">Onboarding</Badge>;
  return <Badge variant="outline">{s}</Badge>;
};

export default function DCClients() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ business_name: '', caller_id: '', contact_email: '', contact_phone: '', plan_tier: '', agent_id: '' });

  const { data: clients = [], refetch } = useQuery({
    queryKey: ['dc-external-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('dc_business_pipelines').select('*').eq('pipeline_type', 'external').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: callStats = [] } = useQuery({
    queryKey: ['dc-client-call-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('ai_call_logs').select('business_id, outcome, created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      return data || [];
    },
  });

  const getClientStats = (name: string) => {
    const calls = callStats.filter((c: any) => c.business_id === name);
    const wins = calls.filter((c: any) => ['booked', 'interested'].includes(c.outcome));
    return { total: calls.length, winRate: calls.length > 0 ? ((wins.length / calls.length) * 100).toFixed(1) : '0.0' };
  };

  const totalMRR = clients.reduce((s: number, c: any) => s + (c.monthly_rate || 0), 0);
  const activeClients = clients.filter((c: any) => c.status === 'active').length;

  const handleOnboardSubmit = async () => {
    const plan = PLANS.find(p => p.tier === form.plan_tier);
    const { error } = await supabase.from('dc_business_pipelines').insert({
      business_name: form.business_name,
      caller_id: form.caller_id,
      pipeline_type: 'external',
      default_agent_id: form.agent_id,
      status: 'onboarding',
      monthly_rate: plan?.rate || 500,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      plan_tier: form.plan_tier,
      billing_start_date: new Date().toISOString().split('T')[0],
    } as any);
    if (error) { toast.error('Failed to create client'); return; }
    toast.success(`${form.business_name} onboarded!`);
    setShowOnboarding(false);
    setStep(1);
    setForm({ business_name: '', caller_id: '', contact_email: '', contact_phone: '', plan_tier: '', agent_id: '' });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Management</h1>
          <p className="text-muted-foreground text-sm">Manage external clients using Dynasty Connect as a service</p>
        </div>
        <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Onboard New Client</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Client Onboarding — Step {step} of 4</DialogTitle>
            </DialogHeader>
            <Progress value={step * 25} className="mb-4" />

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Business Information</h3>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="Client's business name" />
                </div>
                <div className="space-y-2">
                  <Label>Caller ID (their phone number)</Label>
                  <Input value={form.caller_id} onChange={e => setForm({ ...form, caller_id: e.target.value })} placeholder="+1XXXXXXXXXX" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="client@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+1XXXXXXXXXX" />
                  </div>
                </div>
                <Button className="w-full" onClick={() => setStep(2)} disabled={!form.business_name || !form.caller_id}>Next: Select Plan →</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Select Plan</h3>
                <div className="grid gap-3">
                  {PLANS.map(p => (
                    <Card key={p.tier} className={`cursor-pointer transition-all border-2 ${form.plan_tier === p.tier ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`} onClick={() => setForm({ ...form, plan_tier: p.tier })}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-foreground">{p.name}</span>
                          <span className="text-lg font-bold text-primary">${p.rate}<span className="text-xs text-muted-foreground">/mo</span></span>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.calls} · {p.campaigns}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.features.map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                  <Button className="flex-1" onClick={() => setStep(3)} disabled={!form.plan_tier}>Next: Assign Agent →</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Bot className="h-4 w-4" /> Assign AI Agent</h3>
                <Select value={form.agent_id} onValueChange={v => setForm({ ...form, agent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                  <SelectContent>
                    {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">How agent assignment works:</p>
                    <p>The selected agent will handle all calls for this client. The agent speaks as the client's brand — prospects hear their business name, never Dynasty Connect.</p>
                  </CardContent>
                </Card>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                  <Button className="flex-1" onClick={() => setStep(4)} disabled={!form.agent_id}>Next: Review & Launch →</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Rocket className="h-4 w-4" /> Review & Launch</h3>
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Business</span><span className="font-medium text-foreground">{form.business_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Caller ID</span><span className="font-mono text-foreground">{form.caller_id}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plan</span>{planBadge(form.plan_tier)}</div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Agent</span><span className="text-foreground">{AGENTS.find(a => a.id === form.agent_id)?.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-bold text-primary">${PLANS.find(p => p.tier === form.plan_tier)?.rate}/mo</span></div>
                  </CardContent>
                </Card>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>← Back</Button>
                  <Button className="flex-1" onClick={handleOnboardSubmit}><CheckCircle2 className="h-4 w-4 mr-1" /> Launch Client</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-foreground">{clients.length}</p>
          <p className="text-xs text-muted-foreground">Total Clients</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
          <p className="text-2xl font-bold text-foreground">{activeClients}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-400" />
          <p className="text-2xl font-bold text-foreground">${totalMRR.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Monthly MRR</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-400" />
          <p className="text-2xl font-bold text-foreground">{callStats.length}</p>
          <p className="text-xs text-muted-foreground">Calls (30d)</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Client Directory</TabsTrigger>
          <TabsTrigger value="billing">Billing & Plans</TabsTrigger>
          <TabsTrigger value="sla">SLA Tracking</TabsTrigger>
        </TabsList>

        {/* Client Directory */}
        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">External Clients</CardTitle>
              <CardDescription>Businesses paying for Dynasty Connect AI call center services</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No external clients yet</p>
                  <p className="text-sm mt-1">Click "Onboard New Client" to add your first paying customer</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Calls (30d)</TableHead>
                      <TableHead>Win Rate</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c: any) => {
                      const stats = getClientStats(c.business_name);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{c.business_name}</p>
                              <p className="text-xs text-muted-foreground">{(c as any).contact_email || c.caller_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>{planBadge((c as any).plan_tier)}</TableCell>
                          <TableCell className="font-mono text-foreground">${c.monthly_rate || 0}/mo</TableCell>
                          <TableCell>{statusBadge(c.status || 'active')}</TableCell>
                          <TableCell className="text-foreground">{stats.total}</TableCell>
                          <TableCell className="text-foreground">{stats.winRate}%</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost"><BarChart3 className="h-3 w-3" /></Button>
                              <Button size="sm" variant="ghost"><FileText className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing & Plans */}
        <TabsContent value="billing">
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map(p => {
              const planClients = clients.filter((c: any) => (c as any).plan_tier === p.tier);
              return (
                <Card key={p.tier} className="relative overflow-hidden">
                  {p.tier === 'growth' && <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-bl font-medium">Popular</div>}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="text-2xl text-primary">${p.rate}</span>
                    </CardTitle>
                    <CardDescription>/month</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                      <p className="text-foreground font-medium">{p.calls}</p>
                      <p className="text-muted-foreground">{p.campaigns}</p>
                    </div>
                    <div className="space-y-1">
                      {p.features.map(f => (
                        <p key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" /> {f}
                        </p>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{planClients.length} active client{planClients.length !== 1 ? 's' : ''}</p>
                      <p className="text-sm font-bold text-foreground">${planClients.length * p.rate}/mo revenue</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-4 bg-muted/30 border-dashed">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Sales Pitch</h3>
              <p className="text-sm text-muted-foreground italic">
                "Dynasty Connect is a fully autonomous AI call center. Your business makes calls as your brand — prospects hear your company name, not ours. The AI gets smarter from every call. No human agents needed. Starts at $500/month."
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLA Tracking */}
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> SLA Performance</CardTitle>
              <CardDescription>Service level agreement tracking per client</CardDescription>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No clients to track</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Calls (30d)</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Avg Duration</TableHead>
                      <TableHead>SLA Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c: any) => {
                      const stats = getClientStats(c.business_name);
                      const failRate = stats.total > 0 ? 100 - parseFloat(stats.winRate) : 0;
                      const slaOk = failRate <= 95;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-foreground">{c.business_name}</TableCell>
                          <TableCell className="text-foreground">{stats.total}</TableCell>
                          <TableCell className="text-foreground">{stats.winRate}%</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell>
                            {slaOk ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Healthy</Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1"><AlertTriangle className="h-3 w-3" /> At Risk</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
