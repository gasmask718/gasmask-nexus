import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, Star, TrendingUp, Eye } from 'lucide-react';

type TalentProfile = {
  id: string; user_id: string | null; name: string; email: string; phone: string | null;
  niche: string | null; audience_size: number; engagement_rate: number; pricing: number;
  portfolio_url: string | null; bio: string | null; status: string; created_at: string;
};

export default function TalentManagementTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', niche: '', audience_size: '', engagement_rate: '', pricing: '', portfolio_url: '', bio: '' });

  const { data: talent = [] } = useQuery<TalentProfile[]>({
    queryKey: ['dme-talent'],
    queryFn: async () => {
      const { data } = await supabase.from('dme_talent_profiles').select('*').order('created_at', { ascending: false });
      return (data || []) as TalentProfile[];
    }
  });

  const niches = useMemo(() => [...new Set(talent.map(t => t.niche).filter(Boolean))], [talent]);

  const filtered = talent.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase());
    const matchNiche = nicheFilter === 'all' || t.niche === nicheFilter;
    return matchSearch && matchNiche;
  });

  const addTalent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dme_talent_profiles').insert({
        name: form.name, email: form.email, phone: form.phone || null,
        niche: form.niche || null, audience_size: Number(form.audience_size) || 0,
        engagement_rate: Number(form.engagement_rate) || 0, pricing: Number(form.pricing) || 0,
        portfolio_url: form.portfolio_url || null, bio: form.bio || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dme-talent'] });
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', niche: '', audience_size: '', engagement_rate: '', pricing: '', portfolio_url: '', bio: '' });
      toast.success('Talent added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const kpis = useMemo(() => ({
    total: talent.length,
    active: talent.filter(t => t.status === 'active').length,
    avgAudience: talent.length > 0 ? Math.round(talent.reduce((s, t) => s + t.audience_size, 0) / talent.length) : 0,
    avgRate: talent.length > 0 ? (talent.reduce((s, t) => s + Number(t.engagement_rate), 0) / talent.length).toFixed(1) : '0',
  }), [talent]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Talent', val: kpis.total, icon: Users, color: 'text-primary' },
          { label: 'Active', val: kpis.active, icon: Star, color: 'text-emerald-400' },
          { label: 'Avg Audience', val: kpis.avgAudience.toLocaleString(), icon: Eye, color: 'text-purple-400' },
          { label: 'Avg Engagement', val: `${kpis.avgRate}%`, icon: TrendingUp, color: 'text-yellow-400' },
        ].map(k => (
          <Card key={k.label} className="bg-card border-border">
            <CardContent className="p-4">
              <k.icon className={`h-5 w-5 ${k.color} mb-2`} />
              <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search talent..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Niche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Niches</SelectItem>
              {niches.map(n => <SelectItem key={n} value={n!}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Talent</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Talent Profile</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <Input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Input placeholder="Niche (e.g. Fashion, Music)" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} />
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" placeholder="Audience Size" value={form.audience_size} onChange={e => setForm(f => ({ ...f, audience_size: e.target.value }))} />
                <Input type="number" placeholder="Eng. Rate %" value={form.engagement_rate} onChange={e => setForm(f => ({ ...f, engagement_rate: e.target.value }))} />
                <Input type="number" placeholder="Rate $" value={form.pricing} onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))} />
              </div>
              <Input placeholder="Portfolio URL" value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} />
              <Textarea placeholder="Bio" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} />
              <Button onClick={() => addTalent.mutate()} disabled={!form.name || !form.email} className="w-full">Add Talent</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(t => (
          <Card key={t.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-foreground">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                </div>
                <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge>
              </div>
              {t.niche && <Badge variant="outline" className="text-xs mb-2">{t.niche}</Badge>}
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{t.audience_size.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Audience</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{Number(t.engagement_rate)}%</p>
                  <p className="text-[10px] text-muted-foreground">Engagement</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">${Number(t.pricing)}</p>
                  <p className="text-[10px] text-muted-foreground">Rate</p>
                </div>
              </div>
              {t.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.bio}</p>}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No talent profiles found</p>}
      </div>
    </div>
  );
}
