/**
 * AmbassadorRecruitmentLeads — Governed recruitment pipeline
 * Lead → Qualified → Invite → Converted
 * Invites ONLY from qualified leads. No free invite creation.
 */
import { useState } from 'react';
import {
  UserPlus, Plus, Search, Phone, Mail, MapPin, Send,
  ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle,
  Edit, Copy, Filter,
} from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRecruitmentLeads, type RecruitmentLead, type RecruitmentLeadStatus } from '@/hooks/useRecruitmentLeads';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<RecruitmentLeadStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  new: { label: 'New', variant: 'secondary', icon: Clock },
  contacted: { label: 'Contacted', variant: 'secondary', icon: Phone },
  qualified: { label: 'Qualified', variant: 'default', icon: CheckCircle },
  invited: { label: 'Invited', variant: 'outline', icon: Send },
  converted: { label: 'Converted', variant: 'default', icon: UserPlus },
  dead: { label: 'Dead', variant: 'destructive', icon: XCircle },
};

const ALLOWED_TRANSITIONS: Record<RecruitmentLeadStatus, RecruitmentLeadStatus[]> = {
  new: ['contacted', 'dead'],
  contacted: ['qualified', 'dead'],
  qualified: ['dead'], // invited is done via Generate Invite action
  invited: ['dead'],   // converted is automatic on invite acceptance
  converted: [],
  dead: ['new'],       // allow reactivation
};

function RecruitmentLeadsContent() {
  const {
    leads, isLoading, ambassadorId, statusCounts,
    createLead, updateLead, generateInvite,
  } = useRecruitmentLeads();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState<RecruitmentLead | null>(null);
  const [detailLead, setDetailLead] = useState<RecruitmentLead | null>(null);

  // Form state
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', region: '', notes: '' });

  const resetForm = () => setForm({ full_name: '', email: '', phone: '', region: '', notes: '' });

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !search || 
      l.full_name.toLowerCase().includes(search.toLowerCase()) ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search);
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    await createLead.mutateAsync(form);
    setShowAdd(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editLead) return;
    await updateLead.mutateAsync({ id: editLead.id, ...form });
    setEditLead(null);
    resetForm();
  };

  const handleStatusChange = async (lead: RecruitmentLead, newStatus: RecruitmentLeadStatus) => {
    await updateLead.mutateAsync({ id: lead.id, status: newStatus });
    // Refresh detail if open
    if (detailLead?.id === lead.id) {
      setDetailLead({ ...lead, status: newStatus });
    }
  };

  const handleGenerateInvite = async (lead: RecruitmentLead) => {
    const result = await generateInvite.mutateAsync(lead);
    if (result?.token) {
      const link = `${window.location.origin}/invite/ambassador/${result.token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied to clipboard');
    }
    // Refresh detail
    if (detailLead?.id === lead.id) {
      setDetailLead({ ...lead, status: 'invited', invite_id: result?.invite_id || lead.invite_id });
    }
  };

  const openEdit = (lead: RecruitmentLead) => {
    setForm({
      full_name: lead.full_name,
      email: lead.email || '',
      phone: lead.phone || '',
      region: lead.region || '',
      notes: lead.notes || '',
    });
    setEditLead(lead);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Governed Pipeline:</strong> Leads must be qualified before invites can be generated.
          All recruits flow through Lead → Qualified → Invite → Ambassador.
        </AlertDescription>
      </Alert>

      {/* KPI Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {(Object.entries(STATUS_CONFIG) as [RecruitmentLeadStatus, typeof STATUS_CONFIG[RecruitmentLeadStatus]][]).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <Card key={status} className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}>
              <CardContent className="pt-3 pb-2 text-center">
                <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold font-mono">{statusCounts[status] || 0}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Recruitment Lead
        </Button>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] w-full overflow-auto">
            <Table>

              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {leads.length === 0
                        ? 'No recruitment leads yet. Add your first lead to start the pipeline.'
                        : 'No leads match your filters.'}
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.map(lead => {
                  const config = STATUS_CONFIG[lead.status];
                  return (
                    <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailLead(lead)}>
                      <TableCell className="font-medium">{lead.full_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                          {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{lead.region || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {lead.status === 'qualified' && !lead.invite_id && (
                            <Button size="sm" variant="default"
                              onClick={() => handleGenerateInvite(lead)}
                              disabled={generateInvite.isPending}>
                              <Send className="h-3 w-3 mr-1" />
                              Invite
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEdit(lead)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Lead Dialog */}
      <Dialog open={showAdd} onOpenChange={v => { if (!v) { setShowAdd(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Recruitment Lead</DialogTitle>
            <DialogDescription>
              Add a potential ambassador recruit. They must be qualified before an invite can be generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Full name" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input placeholder="email@example.com" type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+1234567890" type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Input placeholder="City / Region" value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Initial notes about this recruit..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLead.isPending}>
              {createLead.isPending ? 'Adding...' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editLead} onOpenChange={v => { if (!v) { setEditLead(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Input value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditLead(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={v => { if (!v) setDetailLead(null); }}>
        <DialogContent className="max-w-lg">
          {detailLead && (() => {
            const config = STATUS_CONFIG[detailLead.status];
            const transitions = ALLOWED_TRANSITIONS[detailLead.status];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailLead.full_name}
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Added {format(new Date(detailLead.created_at), 'PPP')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detailLead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{detailLead.email}</span>
                      </div>
                    )}
                    {detailLead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{detailLead.phone}</span>
                      </div>
                    )}
                    {detailLead.region && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{detailLead.region}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {detailLead.notes && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{detailLead.notes}</p>
                    </div>
                  )}

                  {/* Invite Status */}
                  {detailLead.invite_id && (
                    <Alert className="bg-primary/10 border-primary/30">
                      <Send className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Invite has been generated for this lead.
                        {detailLead.status === 'converted' && ' They have accepted and joined as an ambassador.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Generate Invite (only for qualified leads without invite) */}
                  {detailLead.status === 'qualified' && !detailLead.invite_id && (
                    <Button className="w-full" onClick={() => handleGenerateInvite(detailLead)}
                      disabled={generateInvite.isPending}>
                      <Send className="h-4 w-4 mr-2" />
                      {generateInvite.isPending ? 'Generating Invite...' : 'Generate Invite'}
                    </Button>
                  )}

                  {/* Status Transitions */}
                  {transitions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Change Status</p>
                      <div className="flex gap-2 flex-wrap">
                        {transitions.map(status => {
                          const tc = STATUS_CONFIG[status];
                          return (
                            <Button key={status} size="sm" variant="outline"
                              onClick={() => handleStatusChange(detailLead, status)}
                              disabled={updateLead.isPending}>
                              <ChevronRight className="h-3 w-3 mr-1" />
                              {tc.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => openEdit(detailLead)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => setDetailLead(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AmbassadorRecruitmentLeads() {
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="Recruitment Leads"
        subtitle="Manage your recruit pipeline — Leads must be qualified before invites"
        backPath="/ambassador/dashboard"
        portalIcon={<UserPlus className="h-4 w-4 text-primary-foreground" />}
      >
        <RecruitmentLeadsContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
