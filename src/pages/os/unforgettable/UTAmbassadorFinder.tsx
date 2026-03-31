import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Users, Instagram, Music, Upload, Search, Brain, Copy, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';

const CITIES = ['New York', 'New Jersey', 'Atlanta', 'Miami', 'Philadelphia'];
const HASHTAGS_IG = ['#NYCEvents', '#BrooklynParties', '#NJNightlife', '#EventPlanner', '#PartyVibes', '#BirthdayQueen', '#WeddingPlanner', '#SweetSixteen', '#ATLEvents', '#MiamiParty', '#PhillyEvents', '#EventHost'];
const DM_TEMPLATES = [
  { name: 'Events Focus', text: "Hey {name}! Your {city} event content is 🔥 We're building our ambassador team at Unforgettable Times. Earn 15-25% per booking! Interested? {LINK}" },
  { name: 'Personal', text: "{name} your vibe is exactly what we need! Join our ambassador program, get paid for events you already attend 🎉 {LINK}" },
  { name: 'Direct', text: "Love your content! Unforgettable Times is expanding to {city}. Ambassador spots open — earn $500+/mo. Apply: {LINK}" },
];
const TIKTOK_TEMPLATES = [
  { name: 'TikTok Intro', text: "Your {city} content caught our eye! We're looking for TikTok ambassadors for Unforgettable Times events 🎉 DM for details or apply: {LINK}" },
];

const gradeColor = (g: string) => g === 'A' ? 'bg-green-500/20 text-green-400 border-green-500/30' : g === 'B' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-muted text-muted-foreground';
const gradeIcon = (g: string) => g === 'A' ? '🔥' : g === 'B' ? '⚡' : '';
const statusColor = (s: string) => {
  const m: Record<string, string> = { prospect: 'bg-muted text-muted-foreground', dm_sent: 'bg-blue-500/20 text-blue-400', responded: 'bg-yellow-500/20 text-yellow-400', applied: 'bg-purple-500/20 text-purple-400', converted: 'bg-green-500/20 text-green-400', rejected: 'bg-red-500/20 text-red-400' };
  return m[s] || m.prospect;
};

export default function UTAmbassadorFinder() {
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ platform: 'instagram', username: '', full_name: '', followers_count: '', engagement_rate: '', city: '', state: '', email: '', contact_phone: '', notes: '' });
  const [bulkUsernames, setBulkUsernames] = useState('');
  const [bulkPlatform, setBulkPlatform] = useState('instagram');

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['ambassador-prospects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ut_ambassador_prospects').select('*').order('score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const scoreMutation = useMutation({
    mutationFn: async (prospectsToScore: any[]) => {
      const { data, error } = await supabase.functions.invoke('ut-ambassador-finder', {
        body: { action: 'score_prospects', prospects: prospectsToScore },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`🤖 Scored ${d.scored} prospects with Claude`); queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] }); },
    onError: (e: any) => toast.error(e.message || 'Scoring failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'dm_sent') updates.dm_sent_at = new Date().toISOString();
      if (status === 'responded') updates.responded_at = new Date().toISOString();
      if (status === 'applied') updates.applied_at = new Date().toISOString();
      if (status === 'converted') updates.converted_at = new Date().toISOString();
      const { error } = await supabase.from('ut_ambassador_prospects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] }); },
  });

  const addProspectMutation = useMutation({
    mutationFn: async (prospect: any) => {
      const { error } = await supabase.from('ut_ambassador_prospects').insert(prospect);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Prospect added!'); queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = prospects.filter((p: any) => {
    if (selectedCity !== 'all' && p.city !== selectedCity) return false;
    if (selectedGrade !== 'all' && p.grade !== selectedGrade) return false;
    if (selectedPlatform !== 'all' && p.platform !== selectedPlatform) return false;
    if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
    return true;
  });

  const stats = {
    total: prospects.length,
    ig: prospects.filter((p: any) => p.platform === 'instagram').length,
    tt: prospects.filter((p: any) => p.platform === 'tiktok').length,
    gradeA: prospects.filter((p: any) => p.grade === 'A').length,
    gradeB: prospects.filter((p: any) => p.grade === 'B').length,
    ready: prospects.filter((p: any) => p.grade === 'A' && p.status === 'prospect').length,
  };

  const handleCopyDM = (msg: string, name?: string, city?: string) => {
    const personalized = msg?.replace('{name}', name || '').replace('{city}', city || '').replace('{LINK}', 'https://unforgettabletimes.com/ambassador') || '';
    navigator.clipboard.writeText(personalized);
    toast.success('📋 DM copied to clipboard!');
  };

  const handleManualAdd = () => {
    if (!manualForm.username) return toast.error('Username is required');
    addProspectMutation.mutate({
      platform: manualForm.platform,
      username: manualForm.username.replace('@', ''),
      full_name: manualForm.full_name || null,
      followers_count: parseInt(manualForm.followers_count) || 0,
      engagement_rate: parseFloat(manualForm.engagement_rate) || 0,
      city: manualForm.city || null,
      state: manualForm.state || null,
      email: manualForm.email || null,
      contact_phone: manualForm.contact_phone || null,
      notes: manualForm.notes || null,
    });
    setManualForm({ platform: 'instagram', username: '', full_name: '', followers_count: '', engagement_rate: '', city: '', state: '', email: '', contact_phone: '', notes: '' });
  };

  const handleBulkImport = () => {
    const usernames = bulkUsernames.split('\n').map(u => u.trim().replace('@', '')).filter(Boolean);
    if (!usernames.length) return toast.error('Enter at least one username');
    const records = usernames.map(u => ({ platform: bulkPlatform, username: u, status: 'prospect' as const }));
    Promise.all(records.map(r => supabase.from('ut_ambassador_prospects').upsert(r, { onConflict: 'platform,username', ignoreDuplicates: true })))
      .then(() => { toast.success(`Imported ${usernames.length} usernames`); queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] }); setBulkUsernames(''); });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const records = lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const obj: any = { platform: 'instagram', status: 'prospect' };
        headers.forEach((h, i) => { if (vals[i]) obj[h] = vals[i]; });
        if (obj.followers_count) obj.followers_count = parseInt(obj.followers_count) || 0;
        if (obj.engagement_rate) obj.engagement_rate = parseFloat(obj.engagement_rate) || 0;
        return obj;
      });
      const { error } = await supabase.from('ut_ambassador_prospects').upsert(records, { onConflict: 'platform,username', ignoreDuplicates: true });
      if (error) toast.error(error.message);
      else { toast.success(`${records.length} prospects imported!`); queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] }); }
      setCsvModalOpen(false);
    };
    reader.readAsText(file);
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map((p: any) => p.id));

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('ambassador-prospects-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'ut_ambassador_prospects' }, () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-prospects'] });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🌟 Ambassador Finder</h1>
        <p className="text-muted-foreground">Find perfect Instagram & TikTok ambassadors for Unforgettable Times</p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="instagram">📸 Instagram</TabsTrigger>
          <TabsTrigger value="tiktok">🎵 TikTok</TabsTrigger>
          <TabsTrigger value="all">👥 All Prospects</TabsTrigger>
          <TabsTrigger value="import">📥 Manual Import</TabsTrigger>
        </TabsList>

        {/* INSTAGRAM TAB */}
        <TabsContent value="instagram" className="space-y-4">
          <Card className="border-pink-500/30 bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Instagram className="h-5 w-5 text-pink-400" /> Instagram Search Methods</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">PhantomBuster</span><p className="text-xs text-muted-foreground">Instagram hashtag & profile scraper</p></div>
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">⚠️ Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">Modash.io</span><p className="text-xs text-muted-foreground">Influencer discovery platform</p></div>
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">⚠️ Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">Manual Import</span><p className="text-xs text-muted-foreground">CSV upload or manual entry</p></div>
                <Badge variant="outline" className="text-green-400 border-green-500/30">✅ Always Available</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle>Search by Hashtag</CardTitle><CardDescription>Pre-filled hashtags for Unforgettable Times target audience</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {HASHTAGS_IG.map(h => <Badge key={h} variant="outline" className="cursor-pointer hover:bg-pink-500/20">{h}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => <Button key={c} size="sm" variant="outline" className="text-xs">{c}</Button>)}
              </div>
              <p className="text-sm text-muted-foreground">Connect PhantomBuster to auto-search, or use Manual Import below.</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle>📸 Instagram DM Templates</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {DM_TEMPLATES.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between"><span className="font-medium text-sm">{t.name}</span><Button size="sm" variant="ghost" onClick={() => handleCopyDM(t.text)}><Copy className="h-3 w-3 mr-1" /> Copy</Button></div>
                  <p className="text-xs text-muted-foreground">{t.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIKTOK TAB */}
        <TabsContent value="tiktok" className="space-y-4">
          <Card className="border-purple-500/30 bg-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Music className="h-5 w-5 text-purple-400" /> TikTok Search Methods</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">TikTok Creator Marketplace</span><p className="text-xs text-muted-foreground">Official creator discovery</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-400 border-green-500/30">✅ Free Access</Badge>
                  <Button size="sm" variant="outline" onClick={() => window.open('https://ads.tiktok.com/creator', '_blank')}><ExternalLink className="h-3 w-3 mr-1" /> Open</Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">Modash.io</span><p className="text-xs text-muted-foreground">Cross-platform influencer search</p></div>
                <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">⚠️ Not Connected</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div><span className="font-medium">Manual Import</span><p className="text-xs text-muted-foreground">CSV upload or manual entry</p></div>
                <Badge variant="outline" className="text-green-400 border-green-500/30">✅ Always Available</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle>TikTok Creator Marketplace Instructions</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open TikTok Creator Marketplace above</p>
              <p>2. Search by category: Events / Entertainment</p>
              <p>3. Filter by location: US target cities</p>
              <p>4. Export the creator list as CSV</p>
              <p>5. Import it here using the Manual Import tab</p>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle>🎵 TikTok DM Templates</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {TIKTOK_TEMPLATES.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between"><span className="font-medium text-sm">{t.name}</span><Button size="sm" variant="ghost" onClick={() => handleCopyDM(t.text)}><Copy className="h-3 w-3 mr-1" /> Copy</Button></div>
                  <p className="text-xs text-muted-foreground">{t.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALL PROSPECTS TAB */}
        <TabsContent value="all" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: stats.total, icon: Users },
              { label: 'Instagram', value: stats.ig, icon: Instagram },
              { label: 'TikTok', value: stats.tt, icon: Music },
              { label: '🔥 A-Grade', value: stats.gradeA },
              { label: '⚡ B-Grade', value: stats.gradeB },
              { label: 'Ready to Contact', value: stats.ready },
            ].map((s, i) => (
              <Card key={i} className="bg-card"><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Platform" /></SelectTrigger><SelectContent><SelectItem value="all">All Platforms</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="tiktok">TikTok</SelectItem></SelectContent></Select>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}><SelectTrigger className="w-[110px]"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades</SelectItem><SelectItem value="A">🔥 A</SelectItem><SelectItem value="B">⚡ B</SelectItem><SelectItem value="C">C</SelectItem></SelectContent></Select>
            <Select value={selectedCity} onValueChange={setSelectedCity}><SelectTrigger className="w-[140px]"><SelectValue placeholder="City" /></SelectTrigger><SelectContent><SelectItem value="all">All Cities</SelectItem>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="prospect">Prospect</SelectItem><SelectItem value="dm_sent">DM Sent</SelectItem><SelectItem value="responded">Responded</SelectItem><SelectItem value="applied">Applied</SelectItem><SelectItem value="converted">Converted</SelectItem></SelectContent></Select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex gap-2 items-center bg-muted/30 p-3 rounded-lg">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => {
                const msgs = prospects.filter((p: any) => selectedIds.includes(p.id) && p.ai_dm_message).map((p: any) => `@${p.username}: ${p.ai_dm_message}`).join('\n\n');
                navigator.clipboard.writeText(msgs); toast.success('All DMs copied!');
              }}><Copy className="h-3 w-3 mr-1" /> Copy All DMs</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const unscored = prospects.filter((p: any) => selectedIds.includes(p.id));
                scoreMutation.mutate(unscored.map((p: any) => ({ username: p.username, platform: p.platform, followers_count: p.followers_count, engagement_rate: p.engagement_rate, city: p.city, bio: p.bio })));
              }} disabled={scoreMutation.isPending}>{scoreMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />} Score with Claude</Button>
            </div>
          )}

          {/* Table */}
          <Card className="bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="p-3 text-left"><input type="checkbox" onChange={toggleAll} checked={selectedIds.length === filtered.length && filtered.length > 0} /></th>
                    <th className="p-3 text-left">Profile</th>
                    <th className="p-3 text-left">Platform</th>
                    <th className="p-3 text-left">Followers</th>
                    <th className="p-3 text-left">Eng. Rate</th>
                    <th className="p-3 text-left">City</th>
                    <th className="p-3 text-left">Grade</th>
                    <th className="p-3 text-left">Score</th>
                    <th className="p-3 text-left">AI Summary</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr></thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={11} className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading prospects...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No prospects yet. Use Manual Import to add some!</td></tr>
                    ) : filtered.map((p: any) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="p-3"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="p-3">
                          <a href={p.platform === 'instagram' ? `https://instagram.com/${p.username}` : `https://tiktok.com/@${p.username}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@{p.username}</a>
                          {p.full_name && <p className="text-xs text-muted-foreground">{p.full_name}</p>}
                        </td>
                        <td className="p-3">{p.platform === 'instagram' ? '📸' : '🎵'}</td>
                        <td className="p-3">{(p.followers_count || 0).toLocaleString()}</td>
                        <td className="p-3">{p.engagement_rate || 0}%</td>
                        <td className="p-3 text-xs">{p.city || '—'}</td>
                        <td className="p-3"><Badge variant="outline" className={gradeColor(p.grade)}>{gradeIcon(p.grade)} {p.grade}</Badge></td>
                        <td className="p-3 font-mono">{p.score}</td>
                        <td className="p-3 text-xs max-w-[200px] truncate">{p.ai_summary || '—'}</td>
                        <td className="p-3"><Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge></td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {p.ai_dm_message && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleCopyDM(p.ai_dm_message, p.full_name, p.city)} title="Copy DM"><Copy className="h-3 w-3" /></Button>}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => statusMutation.mutate({ id: p.id, status: 'applied' })} title="Mark Applied"><CheckCircle className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => statusMutation.mutate({ id: p.id, status: 'rejected' })} title="Reject"><XCircle className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Score All Button */}
          <div className="flex gap-2">
            <Button onClick={() => {
              const unscored = prospects.filter((p: any) => !p.ai_summary);
              if (!unscored.length) return toast.info('All prospects already scored');
              scoreMutation.mutate(unscored.map((p: any) => ({ username: p.username, platform: p.platform, followers_count: p.followers_count, engagement_rate: p.engagement_rate, city: p.city, bio: p.bio })));
            }} disabled={scoreMutation.isPending}>
              {scoreMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />} Score All Unscored with Claude
            </Button>
          </div>
        </TabsContent>

        {/* MANUAL IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* CSV Import */}
            <Card className="bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> CSV Import</CardTitle><CardDescription>Upload a CSV with prospect data</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Expected columns: username, platform, full_name, followers_count, engagement_rate, city, state, email, bio</p>
                <Input type="file" accept=".csv" onChange={handleCsvUpload} />
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card className="bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" /> Add Prospect Manually</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={manualForm.platform} onValueChange={v => setManualForm(p => ({ ...p, platform: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="tiktok">TikTok</SelectItem></SelectContent></Select>
                <Input placeholder="@username" value={manualForm.username} onChange={e => setManualForm(p => ({ ...p, username: e.target.value }))} />
                <Input placeholder="Full Name" value={manualForm.full_name} onChange={e => setManualForm(p => ({ ...p, full_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Followers" type="number" value={manualForm.followers_count} onChange={e => setManualForm(p => ({ ...p, followers_count: e.target.value }))} />
                  <Input placeholder="Engagement %" type="number" step="0.1" value={manualForm.engagement_rate} onChange={e => setManualForm(p => ({ ...p, engagement_rate: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="City" value={manualForm.city} onChange={e => setManualForm(p => ({ ...p, city: e.target.value }))} />
                  <Input placeholder="State" value={manualForm.state} onChange={e => setManualForm(p => ({ ...p, state: e.target.value }))} />
                </div>
                <Input placeholder="Email (optional)" value={manualForm.email} onChange={e => setManualForm(p => ({ ...p, email: e.target.value }))} />
                <Input placeholder="Phone (optional)" value={manualForm.contact_phone} onChange={e => setManualForm(p => ({ ...p, contact_phone: e.target.value }))} />
                <Button className="w-full" onClick={handleManualAdd} disabled={addProspectMutation.isPending}>{addProspectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Add Prospect</Button>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Paste */}
          <Card className="bg-card">
            <CardHeader><CardTitle>📋 Bulk Username Import</CardTitle><CardDescription>Paste usernames, one per line</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Select value={bulkPlatform} onValueChange={setBulkPlatform}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="tiktok">TikTok</SelectItem></SelectContent></Select>
              <Textarea placeholder="@username1&#10;@username2&#10;@username3" value={bulkUsernames} onChange={e => setBulkUsernames(e.target.value)} rows={6} />
              <Button onClick={handleBulkImport}>Import Usernames</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
