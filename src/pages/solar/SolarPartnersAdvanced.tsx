import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Handshake, Plus, Trophy, TrendingUp, Globe, Phone, Mail, MapPin, Users,
  DollarSign, Clock, Star, Zap, Send, BarChart3, Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AMBER = '#E8A317';

export default function SolarPartnersAdvanced() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [form, setForm] = useState({
    company_name: '', contact_name: '', phone: '', email: '', website: '',
    states_served: '', installer_type: 'local', commission_percentage: '20',
    financing_options: false, notes: '',
  });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['solar-partners-adv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partners')
        .select('*')
        .order('ranking_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: performance = [] } = useQuery({
    queryKey: ['solar-partner-perf'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partner_performance')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rankings = [] } = useQuery({
    queryKey: ['solar-partner-rankings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partner_rankings')
        .select('*')
        .order('ranking_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: outreach = [] } = useQuery({
    queryKey: ['solar-partner-outreach'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partner_outreach')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['solar-partner-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solar_partner_deals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addPartner = useMutation({
    mutationFn: async () => {
      const statesArr = form.states_served.split(',').map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from('solar_partners').insert({
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email,
        website: form.website,
        states_served: statesArr,
        installer_type: form.installer_type,
        commission_percentage: parseFloat(form.commission_percentage),
        financing_options: form.financing_options,
        notes: form.notes,
        onboarding_stage: 'new',
        contract_status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solar-partners-adv'] });
      toast.success('Partner added to network');
      setShowAdd(false);
      setForm({ company_name: '', contact_name: '', phone: '', email: '', website: '', states_served: '', installer_type: 'local', commission_percentage: '20', financing_options: false, notes: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getPerfForPartner = (pid: string) => performance.find((p: any) => p.partner_id === pid);
  const getRankForPartner = (pid: string) => rankings.find((r: any) => r.partner_id === pid);

  const activePartners = partners.filter((p: any) => p.contract_status === 'active' || p.onboarding_stage === 'live');
  const totalRevenue = deals.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0);
  const totalCommissions = deals.reduce((sum: number, d: any) => sum + (d.commission_amount || 0), 0);

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      A: 'bg-green-500/20 text-green-400 border-green-500/30',
      B: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      C: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[tier] || styles.C;
  };

  const getStageBadge = (stage: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400',
      contacted: 'bg-purple-500/20 text-purple-400',
      interested: 'bg-yellow-500/20 text-yellow-400',
      negotiating: 'bg-orange-500/20 text-orange-400',
      approved: 'bg-green-500/20 text-green-400',
      live: 'bg-emerald-500/20 text-emerald-400',
    };
    return colors[stage] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="h-6 w-6" style={{ color: AMBER }} />
            Floor 7 — Partner Network Engine
          </h1>
          <p className="text-muted-foreground">Nationwide installer acquisition, ranking, and intelligent lead routing</p>
        </div>
        <Button style={{ backgroundColor: AMBER, color: '#000' }} onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Partner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Partners', value: partners.length, icon: Users, color: 'text-blue-400' },
          { label: 'Active/Live', value: activePartners.length, icon: Globe, color: 'text-green-400' },
          { label: 'States Covered', value: [...new Set(partners.flatMap((p: any) => p.states_served || []))].length, icon: MapPin, color: 'text-purple-400' },
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-400' },
          { label: 'Commissions', value: `$${totalCommissions.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-7 w-7 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners">All Partners</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
        </TabsList>

        {/* All Partners */}
        <TabsContent value="partners">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>States</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Rank Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : !partners.length ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No partners yet — start building your network</TableCell></TableRow>
                  ) : (
                    partners.map((p: any) => {
                      const rank = getRankForPartner(p.id);
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedPartner(p)}>
                          <TableCell>
                            <p className="font-medium">{p.company_name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </TableCell>
                          <TableCell className="text-sm">{p.contact_name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.installer_type || 'local'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {(p.states_served || []).slice(0, 3).join(', ')}
                            {(p.states_served || []).length > 3 && ` +${(p.states_served || []).length - 3}`}
                          </TableCell>
                          <TableCell className="font-semibold" style={{ color: AMBER }}>
                            {p.commission_percentage || 0}%
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStageBadge(p.onboarding_stage || 'new')} border-0 text-xs`}>
                              {p.onboarding_stage || 'new'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">
                            {p.ranking_score?.toFixed(0) || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rankings */}
        <TabsContent value="rankings">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" style={{ color: AMBER }} />
                Partner Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!rankings.length ? (
                <p className="text-sm text-muted-foreground">Rankings populate after partners receive and process leads.</p>
              ) : (
                <div className="space-y-3">
                  {rankings.map((r: any, i: number) => {
                    const partner = partners.find((p: any) => p.id === r.partner_id);
                    return (
                      <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/10">
                        <span className="text-2xl font-bold w-8" style={{ color: i < 3 ? AMBER : undefined }}>
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{partner?.company_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{(partner?.states_served || []).join(', ')}</p>
                        </div>
                        <Badge className={`${getTierBadge(r.tier)} border text-sm px-3`}>
                          Tier {r.tier}
                        </Badge>
                        <div className="text-right">
                          <p className="font-bold text-lg" style={{ color: AMBER }}>{r.ranking_score?.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">score</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outreach */}
        <TabsContent value="outreach">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" style={{ color: AMBER }} />
                Partner Outreach Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!outreach.length ? (
                <p className="text-sm text-muted-foreground">No outreach campaigns yet. Start recruiting installers to build your network.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outreach.map((o: any) => {
                      const partner = partners.find((p: any) => p.id === o.partner_id);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{partner?.company_name || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{o.outreach_type}</Badge></TableCell>
                          <TableCell className="text-sm truncate max-w-48">{o.message_sent}</TableCell>
                          <TableCell><Badge variant={o.status === 'replied' ? 'default' : 'secondary'}>{o.status}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.follow_up_date ? formatDistanceToNow(new Date(o.follow_up_date), { addSuffix: true }) : '—'}
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

        {/* Deals */}
        <TabsContent value="deals">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: AMBER }} />
                Partner Deals & Commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!deals.length ? (
                <p className="text-sm text-muted-foreground">No partner deals yet. Deals appear when leads are routed and closed.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Deal Value</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Deal Status</TableHead>
                      <TableHead>Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((d: any) => {
                      const partner = partners.find((p: any) => p.id === d.partner_id);
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{partner?.company_name || '—'}</TableCell>
                          <TableCell className="text-right font-bold">${(d.deal_value || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold" style={{ color: AMBER }}>${(d.commission_amount || 0).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={d.deal_status === 'closed_won' ? 'default' : 'secondary'}>{d.deal_status}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={d.payout_status === 'paid' ? 'default' : 'outline'}>{d.payout_status}</Badge>
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

        {/* Intelligence */}
        <TabsContent value="intelligence">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" style={{ color: AMBER }} />
                  Routing Logic
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { rule: 'State Match', desc: 'Lead state must match partner states_served' },
                  { rule: 'Rank Priority', desc: 'Highest ranking_score partner gets the lead' },
                  { rule: 'Response Timeout', desc: 'If no response in 15 min → reassign to next partner' },
                  { rule: 'Overload Protection', desc: 'Max 10 active leads per partner at once' },
                  { rule: 'Self-Optimization', desc: 'Rankings auto-update based on close rates' },
                ].map((r) => (
                  <div key={r.rule} className="flex items-start gap-2 p-3 rounded-lg bg-muted/20">
                    <Zap className="h-4 w-4 mt-0.5 shrink-0" style={{ color: AMBER }} />
                    <div>
                      <p className="font-medium text-sm">{r.rule}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: AMBER }} />
                  State Coverage Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                {partners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add partners to see state coverage analysis.</p>
                ) : (
                  <div className="space-y-2">
                    {[...new Set(partners.flatMap((p: any) => p.states_served || []))].sort().map((state: string) => {
                      const count = partners.filter((p: any) => (p.states_served || []).includes(state)).length;
                      return (
                        <div key={state} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{state}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(count * 20, 100)}%`, backgroundColor: AMBER }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-16">{count} partner{count !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Partner Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Partner Installer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Company Name *</Label><Input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
            <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
            <div><Label>States Served (comma-separated)</Label><Input value={form.states_served} onChange={e => setForm({...form, states_served: e.target.value})} placeholder="TX, FL, CA, NY" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Installer Type</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.installer_type} onChange={e => setForm({...form, installer_type: e.target.value})}>
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="national">National</option>
                </select>
              </div>
              <div><Label>Commission %</Label><Input type="number" value={form.commission_percentage} onChange={e => setForm({...form, commission_percentage: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.financing_options} onChange={e => setForm({...form, financing_options: e.target.checked})} />
              <Label>Offers Financing Options</Label>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
            <Button className="w-full" style={{ backgroundColor: AMBER, color: '#000' }} disabled={!form.company_name} onClick={() => addPartner.mutate()}>
              Add to Partner Network
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
