import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, TrendingUp, DollarSign, ShieldCheck, Plus, Upload, FileText,
  Calendar, BarChart3, Building2, Download, AlertTriangle, Clock, CheckCircle,
  ArrowUpRight, Activity, Heart
} from 'lucide-react';
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ═══════════════════════════════════════════════════════════════════════
// UBEN HQ — Non-Profit Operations Tracker
// Navy + Gold accent design inside Dynasty OS dark theme
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';
const NAVY = '#1B2A4A';

const ACTIVITY_TYPES = ['Referral', 'Training Delivery', 'Community Placement', 'Contract'];
const DOC_CATEGORIES = ['Formation', 'Governance', 'Filings', 'Programs', 'Reports'];
const COMPLIANCE_CATEGORIES = ['Filings', 'Governance', 'Reports', 'Programs', 'Other'];

// ── Hooks ──────────────────────────────────────────────────────────────

function useUbenPrograms() {
  return useQuery({
    queryKey: ['uben-programs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_programs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenImpactLog() {
  return useQuery({
    queryKey: ['uben-impact-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_impact_log').select('*, uben_programs(name)').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenPartnerActivity() {
  return useQuery({
    queryKey: ['uben-partner-activity'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_partner_activity').select('*').order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenCompliance() {
  return useQuery({
    queryKey: ['uben-compliance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_compliance_calendar').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

function useUbenDocuments() {
  return useQuery({
    queryKey: ['uben-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('uben_documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── KPI Card ───────────────────────────────────────────────────────────

function KPICard({ title, value, icon: Icon, accent = false }: { title: string; value: string | number; icon: any; accent?: boolean }) {
  return (
    <Card className={`border-0 ${accent ? 'bg-gradient-to-br from-[#1B2A4A] to-[#0F1A2E]' : 'bg-card/80'} backdrop-blur-sm`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: accent ? GOLD : undefined }}>{value}</p>
          </div>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
            <Icon className="h-5 w-5" style={{ color: GOLD }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Compliance Chip ────────────────────────────────────────────────────

function DeadlineChip({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'completed') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completed</Badge>;
  const days = differenceInDays(new Date(dueDate), new Date());
  if (days < 0) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">Overdue</Badge>;
  if (days <= 7) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{days}d left</Badge>;
  if (days <= 30) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{days}d left</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{days}d left</Badge>;
}

// ── TAB 1: Dashboard ───────────────────────────────────────────────────

function DashboardTab() {
  const { data: programs = [] } = useUbenPrograms();
  const { data: impactLog = [] } = useUbenImpactLog();
  const { data: compliance = [] } = useUbenCompliance();
  const { data: partnerActivity = [] } = useUbenPartnerActivity();

  const totalServed = impactLog.reduce((sum, e) => sum + (e.participants || 0), 0);
  const activePrograms = programs.filter(p => p.status === 'active').length;
  const totalGrants = partnerActivity.filter(a => a.activity_type === 'Contract').reduce((sum, a) => sum + Number(a.value || 0), 0);
  const pendingCompliance = compliance.filter(c => c.status !== 'completed');
  const completedCompliance = compliance.filter(c => c.status === 'completed');
  const complianceScore = compliance.length > 0 ? Math.round((completedCompliance.length / compliance.length) * 100) : 100;

  // Monthly impact chart data (last 12 months)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const count = impactLog
        .filter(e => { const ed = new Date(e.date); return ed >= start && ed <= end; })
        .reduce((sum, e) => sum + (e.participants || 0), 0);
      months.push({ month: format(d, 'MMM'), served: count });
    }
    return months;
  }, [impactLog]);

  const upcomingDeadlines = pendingCompliance.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total People Served (YTD)" value={totalServed.toLocaleString()} icon={Users} accent />
        <KPICard title="Active Programs" value={activePrograms} icon={Activity} />
        <KPICard title="Total Grant Funding" value={`$${totalGrants.toLocaleString()}`} icon={DollarSign} accent />
        <KPICard title="Compliance Score" value={`${complianceScore}%`} icon={ShieldCheck} />
      </div>

      {/* Impact Chart + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: GOLD }} />
              Monthly People Served (12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                <Line type="monotone" dataKey="served" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: GOLD }} />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All clear ✅</p>
            ) : (
              upcomingDeadlines.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{d.title}</span>
                  <DeadlineChip dueDate={d.due_date} status={d.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── TAB 2: Programs & Impact Log ───────────────────────────────────────

function ProgramsTab() {
  const queryClient = useQueryClient();
  const { data: programs = [], isLoading } = useUbenPrograms();
  const { data: impactLog = [] } = useUbenImpactLog();
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [showAddImpact, setShowAddImpact] = useState(false);

  const addProgram = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_programs').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-programs'] }); toast.success('Program added'); setShowAddProgram(false); },
  });

  const addImpact = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_impact_log').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-impact-log'] }); toast.success('Impact logged'); setShowAddImpact(false); },
  });

  const archiveProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_programs').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-programs'] }); toast.success('Program archived'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Programs</h3>
        <div className="flex gap-2">
          <Dialog open={showAddProgram} onOpenChange={setShowAddProgram}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Add Program</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Program</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addProgram.mutate({ name: fd.get('name'), description: fd.get('description'), start_date: fd.get('start_date') || null }); }} className="space-y-3">
                <div><Label>Name</Label><Input name="name" required /></div>
                <div><Label>Description</Label><Textarea name="description" /></div>
                <div><Label>Start Date</Label><Input name="start_date" type="date" /></div>
                <Button type="submit" disabled={addProgram.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddImpact} onOpenChange={setShowAddImpact}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Log Impact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log Impact Entry</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addImpact.mutate({ program_id: fd.get('program_id'), date: fd.get('date'), participants: Number(fd.get('participants')), outcome_notes: fd.get('outcome_notes'), logged_by: fd.get('logged_by') }); }} className="space-y-3">
                <div><Label>Program</Label>
                  <select name="program_id" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Select program</option>
                    {programs.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
                <div><Label># Participants</Label><Input name="participants" type="number" min="0" required /></div>
                <div><Label>Outcome Notes</Label><Textarea name="outcome_notes" /></div>
                <div><Label>Logged By</Label><Input name="logged_by" /></div>
                <Button type="submit" disabled={addImpact.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No programs yet. Add your first program above.</TableCell></TableRow>
            ) : programs.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{p.description}</TableCell>
                <TableCell>{p.start_date ? format(new Date(p.start_date), 'MMM d, yyyy') : '—'}</TableCell>
                <TableCell>{p.participant_count}</TableCell>
                <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                <TableCell>
                  {p.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => archiveProgram.mutate(p.id)}>Archive</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <h3 className="text-lg font-semibold">Impact Log</h3>
      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Outcome Notes</TableHead>
              <TableHead>Logged By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {impactLog.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No impact entries logged yet.</TableCell></TableRow>
            ) : impactLog.map(e => (
              <TableRow key={e.id}>
                <TableCell>{format(new Date(e.date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{(e as any).uben_programs?.name || '—'}</TableCell>
                <TableCell className="font-medium">{e.participants}</TableCell>
                <TableCell className="max-w-[250px] truncate text-muted-foreground">{e.outcome_notes}</TableCell>
                <TableCell>{e.logged_by || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 3: Partner Activity ────────────────────────────────────────────

function PartnerActivityTab() {
  const queryClient = useQueryClient();
  const { data: activities = [] } = useUbenPartnerActivity();
  const [showAdd, setShowAdd] = useState(false);

  const addActivity = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_partner_activity').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-partner-activity'] }); toast.success('Activity logged'); setShowAdd(false); },
  });

  // Summary stats
  const byCompany = activities.reduce((acc: Record<string, { count: number; value: number }>, a) => {
    if (!acc[a.company_name]) acc[a.company_name] = { count: 0, value: 0 };
    acc[a.company_name].count++;
    acc[a.company_name].value += Number(a.value || 0);
    return acc;
  }, {});

  const totalValue = activities.reduce((sum, a) => sum + Number(a.value || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Partner Activity Log</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Log Activity</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log Partner Activity</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addActivity.mutate({ company_name: fd.get('company_name'), activity_type: fd.get('activity_type'), date: fd.get('date'), people_count: Number(fd.get('people_count') || 0), value: Number(fd.get('value') || 0), notes: fd.get('notes') }); }} className="space-y-3">
              <div><Label>Company Name</Label><Input name="company_name" required /></div>
              <div><Label>Activity Type</Label>
                <select name="activity_type" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label>Date</Label><Input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required /></div>
              <div><Label># of People</Label><Input name="people_count" type="number" min="0" /></div>
              <div><Label>Value ($)</Label><Input name="value" type="number" min="0" step="0.01" /></div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <Button type="submit" disabled={addActivity.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Activities" value={activities.length} icon={Activity} />
        <KPICard title="Companies Supported" value={Object.keys(byCompany).length} icon={Building2} />
        <KPICard title="Total Value Delivered" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} accent />
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No partner activities logged yet.</TableCell></TableRow>
            ) : activities.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.company_name}</TableCell>
                <TableCell><Badge variant="outline">{a.activity_type}</Badge></TableCell>
                <TableCell>{format(new Date(a.date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{a.people_count}</TableCell>
                <TableCell>${Number(a.value || 0).toLocaleString()}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{a.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 4: Document Vault ──────────────────────────────────────────────

function DocumentVaultTab() {
  const queryClient = useQueryClient();
  const { data: docs = [] } = useUbenDocuments();
  const [filterCat, setFilterCat] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    try {
      const filePath = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('uben-docs').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('uben-docs').getPublicUrl(filePath);
      await supabase.from('uben_documents').insert({
        name: fd.get('name') as string || file.name,
        category: fd.get('category') as string,
        file_url: urlData.publicUrl,
        file_size: file.size,
        uploaded_by: fd.get('uploaded_by') as string || 'Admin',
      });
      queryClient.invalidateQueries({ queryKey: ['uben-documents'] });
      toast.success('Document uploaded');
      setShowUpload(false);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Document Vault</h3>
        <div className="flex gap-2">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Upload className="h-4 w-4 mr-1" /> Upload</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <form onSubmit={handleUpload} className="space-y-3">
                <div><Label>Document Name</Label><Input name="name" placeholder="Optional — defaults to filename" /></div>
                <div><Label>Category</Label>
                  <select name="category" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                    {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>File</Label><Input name="file" type="file" required /></div>
                <div><Label>Uploaded By</Label><Input name="uploaded_by" defaultValue="Admin" /></div>
                <Button type="submit" disabled={uploading} style={{ backgroundColor: GOLD, color: '#000' }}>{uploading ? 'Uploading...' : 'Upload'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-0 bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No documents uploaded yet.</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: GOLD }} />{d.name}</TableCell>
                <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                <TableCell>{d.uploaded_by || '—'}</TableCell>
                <TableCell>{format(new Date(d.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell>{d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}</TableCell>
                <TableCell>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── TAB 5: Compliance Calendar ─────────────────────────────────────────

function ComplianceTab() {
  const queryClient = useQueryClient();
  const { data: deadlines = [] } = useUbenCompliance();
  const [showAdd, setShowAdd] = useState(false);

  const addDeadline = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from('uben_compliance_calendar').insert(form);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-compliance'] }); toast.success('Deadline added'); setShowAdd(false); },
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('uben_compliance_calendar').update({ status: 'completed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['uben-compliance'] }); toast.success('Marked complete'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Compliance Calendar</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" style={{ backgroundColor: GOLD, color: '#000' }}><Plus className="h-4 w-4 mr-1" /> Add Deadline</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Compliance Deadline</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addDeadline.mutate({ title: fd.get('title'), due_date: fd.get('due_date'), category: fd.get('category'), notes: fd.get('notes') }); }} className="space-y-3">
              <div><Label>Title</Label><Input name="title" required /></div>
              <div><Label>Due Date</Label><Input name="due_date" type="date" required /></div>
              <div><Label>Category</Label>
                <select name="category" required className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {COMPLIANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" /></div>
              <Button type="submit" disabled={addDeadline.isPending} style={{ backgroundColor: GOLD, color: '#000' }}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {deadlines.length === 0 ? (
          <Card className="border-0 bg-card/80 p-8 text-center text-muted-foreground">No compliance deadlines configured.</Card>
        ) : deadlines.map(d => (
          <Card key={d.id} className="border-0 bg-card/80">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${NAVY}80` }}>
                  <Calendar className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="font-medium text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.category} · Due {format(new Date(d.due_date), 'MMM d, yyyy')}</p>
                  {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DeadlineChip dueDate={d.due_date} status={d.status} />
                {d.status !== 'completed' && (
                  <Button size="sm" variant="ghost" onClick={() => markComplete.mutate(d.id)}>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── TAB 6: Impact Report Generator ─────────────────────────────────────

function ImpactReportTab() {
  const { data: impactLog = [] } = useUbenImpactLog();
  const { data: programs = [] } = useUbenPrograms();
  const { data: partnerActivity = [] } = useUbenPartnerActivity();

  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [narrative, setNarrative] = useState('');

  const filtered = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    return {
      impacts: impactLog.filter(i => { const d = new Date(i.date); return d >= s && d <= e; }),
      activities: partnerActivity.filter(a => { const d = new Date(a.date); return d >= s && d <= e; }),
    };
  }, [impactLog, partnerActivity, startDate, endDate]);

  const totalParticipants = filtered.impacts.reduce((sum, i) => sum + (i.participants || 0), 0);
  const programsDelivered = new Set(filtered.impacts.map(i => i.program_id)).size;
  const companiesSupported = new Set(filtered.activities.map(a => a.company_name)).size;
  const totalValue = filtered.activities.reduce((sum, a) => sum + Number(a.value || 0), 0);

  const copyReport = () => {
    const report = `
UBEN IMPACT REPORT
Period: ${format(new Date(startDate), 'MMM d, yyyy')} — ${format(new Date(endDate), 'MMM d, yyyy')}

SUMMARY
- Total Participants Served: ${totalParticipants.toLocaleString()}
- Programs Delivered: ${programsDelivered}
- Partner Companies Supported: ${companiesSupported}
- Value of Services Delivered: $${totalValue.toLocaleString()}

OUTCOMES NARRATIVE
${narrative || '(No narrative provided)'}
    `.trim();
    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Impact Report Generator</h3>
        <div className="flex items-center gap-2">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[160px]" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Participants Served" value={totalParticipants.toLocaleString()} icon={Users} accent />
        <KPICard title="Programs Delivered" value={programsDelivered} icon={Activity} />
        <KPICard title="Companies Supported" value={companiesSupported} icon={Building2} />
        <KPICard title="Value Delivered" value={`$${totalValue.toLocaleString()}`} icon={DollarSign} accent />
      </div>

      <Card className="border-0 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Outcomes Narrative</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            placeholder="Enter qualitative summary of outcomes, stories, and impact highlights..."
            rows={6}
          />
        </CardContent>
      </Card>

      <Button onClick={copyReport} style={{ backgroundColor: GOLD, color: '#000' }}>
        <Download className="h-4 w-4 mr-2" /> Copy Report to Clipboard
      </Button>
    </div>
  );
}

// ── Main UBEN HQ Page ──────────────────────────────────────────────────

export default function UbenHQ() {
  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}, ${GOLD}40)` }}>
          <Heart className="h-6 w-6" style={{ color: GOLD }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">UBEN HQ</h1>
          <p className="text-sm text-muted-foreground">Non-Profit Operations Tracker — Internal Use Only</p>
        </div>
      </div>

      {/* Tabbed Layout */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="programs" className="text-xs">Programs & Impact</TabsTrigger>
          <TabsTrigger value="partners" className="text-xs">Partner Activity</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Document Vault</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Compliance Calendar</TabsTrigger>
          <TabsTrigger value="report" className="text-xs">Impact Report</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="programs"><ProgramsTab /></TabsContent>
        <TabsContent value="partners"><PartnerActivityTab /></TabsContent>
        <TabsContent value="documents"><DocumentVaultTab /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
        <TabsContent value="report"><ImpactReportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
