import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Sun, Target, Phone, Flame, Star, Upload, Plus, Download, Search,
  CheckCircle2, MoreHorizontal, X, FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AMBER = '#E8A317';

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'appointment_booked', 'negotiation', 'closed', 'dead', 'dnc'] as const;
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-500/20 text-gray-400 border-gray-500',
  contacted: 'bg-blue-500/20 text-blue-400 border-blue-500',
  qualified: 'bg-orange-500/20 text-orange-400 border-orange-500',
  appointment_booked: 'bg-purple-500/20 text-purple-400 border-purple-500',
  negotiation: 'bg-amber-500/20 text-amber-400 border-amber-500',
  closed: 'bg-green-500/20 text-green-400 border-green-500',
  dead: 'bg-red-900/20 text-red-400 border-red-800',
  dnc: 'bg-gray-800/20 text-gray-500 border-gray-700',
};

const SCORE_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white',
  B: 'bg-amber-500 text-white',
  C: 'bg-orange-500 text-white',
  D: 'bg-red-500 text-white',
};

function getScoreGrade(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}



export default function SolarLeadIntelligence() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerLead, setDrawerLead] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');


  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['solar-leads', statusFilter],
    queryFn: async () => {
      let q = supabase.from('solar_leads').select('*').order('created_at', { ascending: false }).limit(200);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['solar-lead-stats'],
    queryFn: async () => {
      const [total, qualified, appointed, hot, aRated] = await Promise.all([
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'appointment_booked'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'negotiation'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).gte('lead_score', 80),
      ]);
      return { total: total.count || 0, qualified: qualified.count || 0, appointed: appointed.count || 0, hot: hot.count || 0, aRated: aRated.count || 0 };
    },
    refetchInterval: 30000,
  });


  // Filtered leads
  const filtered = useMemo(() => {
    if (!search) return leads;
    const s = search.toLowerCase();
    return leads.filter((l: any) =>
      (l.full_name || '').toLowerCase().includes(s) ||
      (l.address || '').toLowerCase().includes(s) ||
      (l.city || '').toLowerCase().includes(s) ||
      (l.phone || '').includes(s) ||
      (l.state || '').toLowerCase().includes(s)
    );
  }, [leads, search]);


  const addLead = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('solar_leads').insert(lead);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['solar-leads'] }); queryClient.invalidateQueries({ queryKey: ['solar-lead-stats'] }); toast.success('Lead added'); setShowAddModal(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const st = stats || { total: 0, qualified: 0, appointed: 0, hot: 0, aRated: 0 };

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6" style={{ color: AMBER }} />
          Floor 1 — Lead Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">Import, score, qualify, and launch solar campaigns</p>
      </div>

      <div className="space-y-6">
          {/* Header actions */}
          <div className="flex items-center justify-end flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Lead
            </Button>
            <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Upload CSV</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Leads', value: st.total, icon: Target, color: 'text-gray-400' },
              { label: 'Qualified', value: st.qualified, icon: CheckCircle2, color: 'text-green-400' },
              { label: 'Appointments', value: st.appointed, icon: FileText, color: 'text-purple-400' },
              { label: 'Hot Leads', value: st.hot, icon: Flame, color: 'text-orange-400' },
              { label: 'A-Rated', value: st.aRated, icon: Star, color: 'text-amber-400' },
            ].map((m) => (
              <Card key={m.label} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, address, city, phone, state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${statusFilter === s
                    ? 'text-white border-transparent'
                    : 'text-muted-foreground border-border hover:bg-accent'
                  }`}
                  style={statusFilter === s ? { backgroundColor: AMBER } : undefined}
                >
                  {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Showing {filtered.length} leads</p>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Sun className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No solar leads yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload leads, add manually, or connect ad sources</p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Lead
                  </Button>
                  <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Upload CSV</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10"><Checkbox /></TableHead>
                    <TableHead className="w-16">Score</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead: any) => {
                    const grade = lead.lead_score ? getScoreGrade(lead.lead_score) : null;
                    return (
                      <TableRow
                        key={lead.id}
                        className={`cursor-pointer transition-colors hover:bg-accent/30 ${
                          lead.status === 'qualified' || lead.status === 'appointment_booked' ? 'border-l-2' : ''
                        }`}
                        style={
                          lead.status === 'qualified' || lead.status === 'appointment_booked'
                            ? { borderLeftColor: AMBER }
                            : grade === 'A' ? { borderLeftColor: '#BA7517', borderLeftWidth: 2 } : undefined
                        }
                        onClick={() => setDrawerLead(lead)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleSelect(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {grade ? (
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${SCORE_COLORS[grade]}`}>
                              {grade}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'}</div>
                          {lead.email && <div className="text-xs text-muted-foreground">{lead.email}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{lead.city || '—'}, {lead.state || ''}</div>
                          {lead.address && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.address}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{lead.phone || '—'}</TableCell>
                        <TableCell className="text-sm">{lead.monthly_bill_range || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{lead.lead_source || 'manual'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[lead.status] || ''}`}>
                            {(lead.status || 'new').replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lead.last_called_at ? formatDistanceToNow(new Date(lead.last_called_at), { addSuffix: true }) : 'Never'}
                          {lead.call_count > 0 && <div>{lead.call_count} calls</div>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline">Assign Agent</Button>
              <Button size="sm" variant="outline">Add to Campaign</Button>
              <Button size="sm" variant="outline">Mark DNC</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Deselect</Button>
            </div>
          )}
      </div>



      {/* Lead Detail Drawer */}
      {drawerLead && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-card border-l z-50 shadow-2xl overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{drawerLead.full_name || `${drawerLead.first_name || ''} ${drawerLead.last_name || ''}`.trim()}</h2>
                <p className="text-sm text-muted-foreground">{drawerLead.address}, {drawerLead.city} {drawerLead.state} {drawerLead.zip}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDrawerLead(null)}><X className="h-5 w-5" /></Button>
            </div>

            {drawerLead.lead_score > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold ${SCORE_COLORS[getScoreGrade(drawerLead.lead_score)]}`}>
                  {getScoreGrade(drawerLead.lead_score)}
                </span>
                <div>
                  <p className="text-sm font-medium">Lead Score: {drawerLead.lead_score}/100</p>
                  <p className="text-xs text-muted-foreground">AI-computed qualification score</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: AMBER }}>Contact Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Phone:</span> {drawerLead.phone || '—'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {drawerLead.email || '—'}</div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: AMBER }}>Qualification</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Homeowner:</span> {drawerLead.homeowner_status ? '✓ Yes' : drawerLead.homeowner_status === false ? '✗ No' : '—'}</div>
                  <div><span className="text-muted-foreground">Monthly Bill:</span> {drawerLead.monthly_bill_range || '—'}</div>
                  <div><span className="text-muted-foreground">Credit:</span> {drawerLead.credit_range || '—'}</div>
                  <div><span className="text-muted-foreground">Roof Type:</span> {drawerLead.roof_type || '—'}</div>
                  <div><span className="text-muted-foreground">Roof Age:</span> {drawerLead.roof_age_years ? `${drawerLead.roof_age_years} yrs` : '—'}</div>
                  <div><span className="text-muted-foreground">Interest:</span> {drawerLead.interest_level}/10</div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: AMBER }}>Status & Actions</h3>
                <Badge variant="outline" className={`${STATUS_COLORS[drawerLead.status] || ''} mb-3`}>
                  {(drawerLead.status || 'new').replace(/_/g, ' ')}
                </Badge>
                <div className="flex gap-2">
                  <Button size="sm" style={{ backgroundColor: AMBER }}><Phone className="h-3 w-3 mr-1" /> Call</Button>
                  <Button size="sm" variant="outline">Book Appointment</Button>
                  <Button size="sm" variant="outline">Route to Partner</Button>
                </div>
              </div>
              {drawerLead.notes && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: AMBER }}>Notes</h3>
                  <p className="text-sm text-muted-foreground">{drawerLead.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Solar Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            addLead.mutate({
              full_name: `${fd.get('first_name')} ${fd.get('last_name')}`.trim(),
              first_name: fd.get('first_name'),
              last_name: fd.get('last_name'),
              phone: fd.get('phone'),
              email: fd.get('email'),
              address: fd.get('address'),
              city: fd.get('city'),
              state: fd.get('state'),
              zip: fd.get('zip'),
              monthly_bill_range: fd.get('bill'),
              homeowner_status: fd.get('homeowner') === 'true',
              lead_source: fd.get('source') || 'manual',
            });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input name="first_name" required /></div>
              <div><Label>Last Name</Label><Input name="last_name" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input name="phone" required /></div>
              <div><Label>Email</Label><Input name="email" type="email" /></div>
            </div>
            <div><Label>Address</Label><Input name="address" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input name="city" /></div>
              <div><Label>State</Label><Input name="state" /></div>
              <div><Label>Zip</Label><Input name="zip" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Bill</Label>
                <Select name="bill">
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="$100-$150">$100-$150</SelectItem>
                    <SelectItem value="$150-$200">$150-$200</SelectItem>
                    <SelectItem value="$200-$300">$200-$300</SelectItem>
                    <SelectItem value="$300+">$300+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Homeowner?</Label>
                <Select name="homeowner">
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Source</Label>
              <Select name="source">
                <SelectTrigger><SelectValue placeholder="manual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="ads">Facebook Ads</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" style={{ backgroundColor: AMBER }} disabled={addLead.isPending}>
              {addLead.isPending ? 'Saving...' : 'Save Lead'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
