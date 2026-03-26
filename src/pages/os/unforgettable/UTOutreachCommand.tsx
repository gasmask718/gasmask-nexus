import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone, MessageSquare, Mail, Bot, Plus, Search, TrendingUp, Users, Target,
  Zap, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle, X,
  ArrowRight, Send, Calendar, Star, Shield, RefreshCw, Copy, BarChart3,
  Link as LinkIcon, ExternalLink, FileSpreadsheet, MapPin
} from 'lucide-react';
import { format, isBefore, isToday, addHours } from 'date-fns';
import {
  useUTPartnerLeads, useUTOutreachLogs, useUTLeadMutations, useUTLeadStats,
  useUTVAPerformance, useUTOnboarding, useUTOutcomeDistribution, UTPartnerLead
} from '@/hooks/useUTPartnerLeads';
import {
  UT_DISPOSITIONS, UTDispositionValue, UT_FOLLOW_UP_PRESETS,
  UT_SCRIPTS, UT_OBJECTIONS, UT_SMS_TEMPLATES, VA_DAILY_QUOTAS
} from '@/config/utScripts';
import { toast } from 'sonner';
import UTLeadImporter from '@/components/unforgettable/UTLeadImporter';

const CATEGORIES = [
  { value: 'event_hall', label: 'Event Hall' },
  { value: 'decorator', label: 'Decorator' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'rental_company', label: 'Rental Co.' },
  { value: 'entertainer', label: 'Entertainer' },
  { value: 'dj', label: 'DJ / Musician' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'security', label: 'Security' },
  { value: 'cleaner', label: 'Cleaner' },
  { value: 'server', label: 'Server' },
  { value: 'florist', label: 'Florist' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  interested: 'bg-green-500/15 text-green-400 border-green-500/30',
  callback: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  onboarded: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  dead: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const QUEUE_FILTERS = [
  { value: 'all', label: 'All', icon: Users },
  { value: 'new', label: 'New', icon: Zap },
  { value: 'callback_due', label: 'Callbacks', icon: Clock },
  { value: 'interested', label: 'Interested', icon: Star },
  { value: 'no_answer', label: 'No Answer', icon: Phone },
  { value: 'high_score', label: '70+', icon: Target },
] as const;

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function UTOutreachCommand() {
  const navigate = useNavigate();
  const [queueMode, setQueueMode] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedLead, setSelectedLead] = useState<UTPartnerLead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [rightTab, setRightTab] = useState<'intel' | 'analytics'>('intel');
  const [currentPage, setCurrentPage] = useState(0);

  // Disposition state
  const [disposition, setDisposition] = useState<UTDispositionValue>('no_answer');
  const [callNotes, setCallNotes] = useState('');
  const [followUpPreset, setFollowUpPreset] = useState('');
  const [customFollowUp, setCustomFollowUp] = useState('');
  const [showScripts, setShowScripts] = useState(true);
  const [showObjections, setShowObjections] = useState(false);
  const [showSmsTemplates, setShowSmsTemplates] = useState(false);
  const [scriptCategory, setScriptCategory] = useState<string>('');
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  const [newLead, setNewLead] = useState({
    business_name: '', contact_name: '', category: 'other', phone: '', email: '', city: '', state: '', source: 'manual', notes: '',
  });

  // Queries
  const { data: leadsResult, isLoading } = useUTPartnerLeads({
    queueMode: queueMode as any,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchText || undefined,
    page: currentPage,
  });
  const leads = leadsResult?.leads || [];
  const totalCount = leadsResult?.totalCount || 0;
  const totalPages = leadsResult?.totalPages || 1;

  const { data: stats } = useUTLeadStats();
  const { data: vaPerf } = useUTVAPerformance();
  const { data: logsData, fetchNextPage: fetchMoreLogs, hasNextPage: hasMoreLogs } = useUTOutreachLogs(selectedLead?.id);
  const allLogs = useMemo(() => logsData?.pages?.flatMap(p => p.logs) || [], [logsData]);
  const logsCount = logsData?.pages?.[0]?.totalCount || 0;
  const { data: onboarding } = useUTOnboarding(selectedLead?.id);
  const { data: outcomeDist } = useUTOutcomeDistribution();
  const {
    createLead, saveCallDisposition, handoffToPartnerProfile,
    deleteLead, updateLead, sendSmsTemplate, sendOnboardingLink
  } = useUTLeadMutations();

  // Auto-set script category from lead
  useEffect(() => {
    if (selectedLead) setScriptCategory(selectedLead.category || 'other');
  }, [selectedLead?.id]);

  // Track unsaved notes
  useEffect(() => {
    setHasUnsavedNotes(callNotes.length > 0);
  }, [callNotes]);

  // Server-side sorting handles priority; leads come pre-sorted
  const sortedLeads = leads;

  const currentScript = UT_SCRIPTS[scriptCategory] || UT_SCRIPTS.other;
  const selectedDispo = UT_DISPOSITIONS.find(d => d.value === disposition);

  const handleSelectLead = useCallback((lead: UTPartnerLead) => {
    if (hasUnsavedNotes) {
      if (!window.confirm('You have unsaved notes. Switch leads anyway?')) return;
    }
    setSelectedLead(lead);
    setCallNotes('');
    setDisposition('no_answer');
    setFollowUpPreset('');
    setShowSmsTemplates(false);
    setHasUnsavedNotes(false);
  }, [hasUnsavedNotes]);

  const handleSaveDisposition = () => {
    if (!selectedLead) return;
    if (selectedDispo?.requireFollowUp && !followUpPreset && disposition !== 'interested' && disposition !== 'onboarded') {
      toast.error('Please select a follow-up time for this disposition');
      return;
    }
    let follow_up_at: string | undefined;
    let callback_due_at: string | undefined;
    if (followUpPreset && followUpPreset !== 'custom') {
      const preset = UT_FOLLOW_UP_PRESETS.find(p => p.key === followUpPreset);
      if (preset) {
        const dt = addHours(new Date(), preset.hoursFromNow);
        follow_up_at = dt.toISOString();
        if (disposition === 'callback_requested') callback_due_at = dt.toISOString();
      }
    } else if (followUpPreset === 'custom' && customFollowUp) {
      follow_up_at = new Date(customFollowUp).toISOString();
      if (disposition === 'callback_requested') callback_due_at = follow_up_at;
    }

    saveCallDisposition.mutate({
      lead_id: selectedLead.id,
      channel: 'call',
      disposition,
      notes: callNotes || undefined,
      follow_up_at,
      callback_due_at,
    }, {
      onSuccess: (result) => {
        setCallNotes('');
        setFollowUpPreset('');
        setCustomFollowUp('');
        setDisposition('no_answer');
        setHasUnsavedNotes(false);

        if (result.disposition === 'onboarded') {
          handoffToPartnerProfile.mutate(selectedLead);
        }

        // Auto-advance
        const idx = sortedLeads.findIndex(l => l.id === selectedLead.id);
        if (idx < sortedLeads.length - 1) {
          setSelectedLead(sortedLeads[idx + 1]);
        }
      },
    });
  };

  const handleSendSms = (templateKey: string) => {
    if (!selectedLead) return;
    sendSmsTemplate.mutate({ lead: selectedLead, templateKey });
  };

  const handleAddLead = () => {
    if (!newLead.business_name.trim()) return;
    createLead.mutate(newLead, {
      onSuccess: () => {
        setShowAddDialog(false);
        setNewLead({ business_name: '', contact_name: '', category: 'other', phone: '', email: '', city: '', state: '', source: 'manual', notes: '' });
      },
    });
  };

  const getUrgencyBadge = (lead: UTPartnerLead) => {
    if (!lead.callback_due_at) return null;
    const due = new Date(lead.callback_due_at);
    const now = new Date();
    if (isBefore(due, now)) return <Badge className="bg-red-500/20 text-red-400 text-[9px] border-red-500/30">OVERDUE</Badge>;
    if (isToday(due)) return <Badge className="bg-orange-500/20 text-orange-400 text-[9px] border-orange-500/30">TODAY</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-400 text-[9px] border-blue-500/30">UPCOMING</Badge>;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* ── TOP BAR: Quota Progress ──────────────────────────────── */}
      <div className="border-b border-border/50 bg-card/50 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">🎉 VA Call Console</h1>
            <Badge variant="outline" className="text-[10px]">{totalCount} leads • p{currentPage + 1}/{totalPages}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {[
              { label: 'Calls', val: vaPerf?.calls_made || 0, max: VA_DAILY_QUOTAS.calls, color: '' },
              { label: 'Connects', val: vaPerf?.connected || 0, max: VA_DAILY_QUOTAS.connects, color: '' },
              { label: 'Interested', val: vaPerf?.interested || 0, max: VA_DAILY_QUOTAS.interested, color: 'text-green-400' },
              { label: 'Onboarded', val: vaPerf?.onboarded || 0, max: VA_DAILY_QUOTAS.onboarded, color: 'text-emerald-400' },
              { label: 'SMS', val: vaPerf?.sms_sent || 0, max: 20, color: 'text-blue-400' },
            ].map(q => (
              <div key={q.label} className="flex items-center gap-2">
                <span className={`text-muted-foreground ${q.color}`}>{q.label}</span>
                <Progress value={Math.min((q.val / q.max) * 100, 100)} className="w-16 h-1.5" />
                <span className={`font-mono font-bold ${q.color}`}>{q.val}/{q.max}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Conv%</span>
              <span className="font-mono font-bold">{vaPerf?.conversion_rate || 0}%</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => navigate('/os/unforgettable/places')}>
              <MapPin className="h-3.5 w-3.5" /> Places
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => navigate('/os/unforgettable/territory')}>
              <Target className="h-3.5 w-3.5" /> Territory
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => navigate('/os/unforgettable/products')}>
              <Package className="h-3.5 w-3.5" /> Products
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => setShowImporter(true)}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-7"><Plus className="h-3.5 w-3.5" /> Add Lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add Partner Lead</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Business Name *</Label><Input value={newLead.business_name} onChange={e => setNewLead(p => ({ ...p, business_name: e.target.value }))} /></div>
                    <div><Label>Contact Name</Label><Input value={newLead.contact_name} onChange={e => setNewLead(p => ({ ...p, contact_name: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Category</Label>
                      <Select value={newLead.category} onValueChange={v => setNewLead(p => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Source</Label>
                      <Select value={newLead.source} onValueChange={v => setNewLead(p => ({ ...p, source: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="outscraper">Outscraper</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>City</Label><Input value={newLead.city} onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))} /></div>
                    <div><Label>State</Label><Input value={newLead.state} onChange={e => setNewLead(p => ({ ...p, state: e.target.value }))} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} /></div>
                  <Button onClick={handleAddLead} disabled={createLead.isPending}>{createLead.isPending ? 'Adding...' : 'Add Lead'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Import overlay */}
      {showImporter && (
        <div className="absolute inset-0 z-50 bg-background/95 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">
            <UTLeadImporter onClose={() => setShowImporter(false)} />
          </div>
        </div>
      )}
      {/* ── 3-PANEL LAYOUT ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ═══ LEFT PANEL — CALL QUEUE ═══ */}
        <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
          <div className="p-2 border-b border-border/30 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search name, phone, city..." className="pl-8 h-8 text-xs" value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUEUE_FILTERS.map(f => (
                <Button key={f.value} variant={queueMode === f.value ? 'default' : 'ghost'} size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => setQueueMode(f.value)}>
                  <f.icon className="h-3 w-3" />{f.label}
                </Button>
              ))}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />Loading...</div>
            ) : sortedLeads.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">No leads match filters</div>
            ) : (
              <div className="divide-y divide-border/20">
                {sortedLeads.map(lead => (
                  <div key={lead.id} className={`p-2.5 cursor-pointer transition-colors hover:bg-muted/30 ${selectedLead?.id === lead.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`} onClick={() => handleSelectLead(lead)}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{lead.business_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{lead.contact_name || 'No contact'} • {(lead.category || '').replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-muted-foreground">{lead.phone || 'No phone'} • {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`font-mono text-[10px] font-bold ${lead.ai_score >= 70 ? 'text-green-400' : lead.ai_score >= 40 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{lead.ai_score}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</Badge>
                        {getUrgencyBadge(lead)}
                        {lead.ai_call_eligible && <Badge className="bg-purple-500/20 text-purple-400 text-[9px] border-purple-500/30">AI</Badge>}
                      </div>
                    </div>
                    {lead.outreach_count > 0 && (
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{lead.outreach_count} touches • Last: {lead.last_outcome || '—'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="border-t border-border/30 p-2 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                ← Prev
              </Button>
              <span className="text-[10px] text-muted-foreground">{currentPage + 1} / {totalPages}</span>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                Next →
              </Button>
            </div>
          )}
        </div>

        {/* ═══ CENTER PANEL — LIVE CALL CONSOLE ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedLead ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a lead from the queue to begin</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Lead Identity Card */}
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold">{selectedLead.business_name}</h2>
                        <p className="text-sm text-muted-foreground">{selectedLead.contact_name || 'No contact name'} • {(selectedLead.category || '').replace(/_/g, ' ')}</p>
                        <p className="text-sm text-muted-foreground">{[selectedLead.city, selectedLead.state].filter(Boolean).join(', ') || 'No location'}</p>
                        {selectedLead.next_step && <Badge variant="outline" className="mt-1 text-[10px]">Next: {selectedLead.next_step}</Badge>}
                      </div>
                      <div className="text-right">
                        <Badge className={`${STATUS_COLORS[selectedLead.status] || ''}`}>{selectedLead.status}</Badge>
                        <p className="text-lg font-mono font-bold mt-1">{selectedLead.ai_score}</p>
                        <p className="text-[10px] text-muted-foreground">AI Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {selectedLead.phone ? (
                    <>
                      <Button className="gap-1.5 flex-1" onClick={() => window.open(`tel:${selectedLead.phone}`)}>
                        <Phone className="h-4 w-4" /> Call
                      </Button>
                      <Button variant="outline" className="gap-1.5 flex-1" onClick={() => setShowSmsTemplates(!showSmsTemplates)}>
                        <MessageSquare className="h-4 w-4" /> SMS
                      </Button>
                      <Button variant="outline" className="gap-1.5" onClick={() => {
                        updateLead.mutate({ id: selectedLead.id, ai_call_eligible: true, ai_handoff_reason: 'Manual queue' } as any);
                        toast.success('Queued for AI call');
                      }}>
                        <Bot className="h-4 w-4" /> AI Call
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 text-center text-sm text-destructive bg-destructive/10 rounded-md py-2">⚠️ No phone number</div>
                  )}
                  {selectedLead.email && (
                    <Button variant="outline" className="gap-1.5" onClick={() => window.open(`mailto:${selectedLead.email}`)}>
                      <Mail className="h-4 w-4" /> Email
                    </Button>
                  )}
                </div>

                {/* SMS Templates — with SEND buttons */}
                {showSmsTemplates && (
                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>📱 SMS Templates</span>
                        <Button variant="ghost" size="sm" className="h-6" onClick={() => setShowSmsTemplates(false)}><X className="h-3.5 w-3.5" /></Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {UT_SMS_TEMPLATES.map(tpl => {
                        const hydrated = tpl.body
                          .replace(/\[Contact Name\]/g, selectedLead.contact_name || 'there')
                          .replace(/\[Business Name\]/g, selectedLead.business_name)
                          .replace(/\[City\]/g, selectedLead.city || 'your area')
                          .replace(/\[VA Name\]/g, '[Your Name]')
                          .replace(/\[LINK\]/g, 'https://unforgettabletimes.com/join');
                        return (
                          <div key={tpl.key} className="flex items-start justify-between gap-2 p-2 rounded bg-background/50 border border-border/20">
                            <div className="flex-1">
                              <p className="text-xs font-medium">{tpl.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{hydrated}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => copyToClipboard(hydrated, tpl.label)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="sm" className="h-7 px-2 text-xs gap-1" disabled={sendSmsTemplate.isPending} onClick={() => handleSendSms(tpl.key)}>
                                <Send className="h-3 w-3" /> Send
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Script Panel with category selector */}
                <Collapsible open={showScripts} onOpenChange={setShowScripts}>
                  <CollapsibleTrigger asChild>
                    <Card className="border-pink-500/20 bg-pink-500/5 cursor-pointer">
                      <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>🎤 {currentScript.label} Script</span>
                          {showScripts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="border-pink-500/20 bg-pink-500/5 border-t-0 rounded-t-none">
                      <CardContent className="p-4 space-y-3 text-sm">
                        {/* Script switcher */}
                        <Select value={scriptCategory} onValueChange={setScriptCategory}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        {[
                          { key: 'opening', label: 'OPENING', color: 'text-pink-400', bg: 'bg-background/50 border-border/20' },
                          { key: 'value_prop', label: 'VALUE PROPOSITION', color: 'text-pink-400', bg: 'bg-background/50 border-border/20' },
                          { key: 'close', label: 'CLOSE', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                          { key: 'voicemail', label: 'VOICEMAIL', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                        ].map(section => {
                          const text = (currentScript as any)[section.key]
                            .replace(/\[Business Name\]/g, selectedLead.business_name)
                            .replace(/\[Contact Name\]/g, selectedLead.contact_name || 'there')
                            .replace(/\[VA Name\]/g, '[Your Name]')
                            .replace(/\[City\]/g, selectedLead.city || 'your area')
                            .replace(/\[Number\]/g, '[Your Number]');
                          return (
                            <div key={section.key} className={`rounded p-3 border ${section.bg} relative group`}>
                              <p className={`text-[10px] font-semibold ${section.color} mb-1`}>{section.label}</p>
                              <p className="italic text-xs">{text}</p>
                              <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(text, section.label)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* Objection Handling */}
                <Collapsible open={showObjections} onOpenChange={setShowObjections}>
                  <CollapsibleTrigger asChild>
                    <Card className="border-amber-500/20 bg-amber-500/5 cursor-pointer">
                      <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>🛡️ Objection Handling ({UT_OBJECTIONS.length})</span>
                          {showObjections ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="border-amber-500/20 bg-amber-500/5 border-t-0 rounded-t-none">
                      <CardContent className="p-3 space-y-2">
                        {UT_OBJECTIONS.map((obj, i) => (
                          <div key={i} className="bg-background/50 rounded p-2.5 border border-border/20 group relative">
                            <p className="text-xs font-semibold text-amber-400">"{obj.trigger}"</p>
                            <p className="text-xs text-muted-foreground mt-1 italic">{obj.response
                              .replace('[category]', (selectedLead.category || '').replace(/_/g, ' '))
                              .replace('[city]', selectedLead.city || 'your area')
                            }</p>
                            <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => copyToClipboard(obj.response, 'Objection response')}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* ── DISPOSITION PANEL ──────────────────────────── */}
                <Card className="border-primary/30 bg-primary/5 sticky bottom-0">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm">📋 Call Disposition</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <Select value={disposition} onValueChange={v => setDisposition(v as UTDispositionValue)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UT_DISPOSITIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Textarea placeholder="Call notes..." value={callNotes} onChange={e => setCallNotes(e.target.value)} className="h-16 text-sm" />

                    {selectedDispo?.requireFollowUp && (
                      <div className="space-y-2">
                        <Label className="text-xs">Follow-Up Schedule {selectedDispo.requireFollowUp && '(Required)'}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {UT_FOLLOW_UP_PRESETS.map(p => (
                            <Button key={p.key} variant={followUpPreset === p.key ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setFollowUpPreset(p.key)}>
                              {p.label}
                            </Button>
                          ))}
                        </div>
                        {followUpPreset === 'custom' && (
                          <Input type="datetime-local" value={customFollowUp} onChange={e => setCustomFollowUp(e.target.value)} className="h-8" />
                        )}
                      </div>
                    )}

                    {/* Post-call SMS suggestion */}
                    {(disposition === 'voicemail_left' || disposition === 'send_info' || disposition === 'interested' || disposition === 'owner_unavailable') && selectedLead.phone && (
                      <div className="bg-blue-500/10 rounded p-2 border border-blue-500/20">
                        <p className="text-[10px] text-blue-400 font-semibold mb-1">💡 Suggested SMS Follow-Up</p>
                        <Button size="sm" className="h-7 text-xs gap-1 w-full" variant="outline" disabled={sendSmsTemplate.isPending} onClick={() => {
                          const map: Record<string, string> = {
                            voicemail_left: 'missed_you_text',
                            send_info: 'send_info_text',
                            interested: 'interested_followup',
                            owner_unavailable: 'owner_unavailable_text',
                          };
                          handleSendSms(map[disposition] || 'intro_text');
                        }}>
                          <Send className="h-3 w-3" /> Send {disposition === 'voicemail_left' ? 'Missed You' : disposition === 'send_info' ? 'Info' : disposition === 'interested' ? 'Follow-Up' : 'Owner'} SMS
                        </Button>
                      </div>
                    )}

                    <Button className="w-full gap-2" onClick={handleSaveDisposition} disabled={saveCallDisposition.isPending}>
                      {saveCallDisposition.isPending ? (
                        <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4" /> Save & Next Lead</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ═══ RIGHT PANEL — INTELLIGENCE + ANALYTICS ═══ */}
        <div className="w-72 border-l border-border/50 flex flex-col bg-card/30 overflow-hidden">
          <div className="border-b border-border/30 px-2 pt-2">
            <div className="flex gap-1">
              <Button variant={rightTab === 'intel' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs flex-1" onClick={() => setRightTab('intel')}>Intel</Button>
              <Button variant={rightTab === 'analytics' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs flex-1" onClick={() => setRightTab('analytics')}>
                <BarChart3 className="h-3 w-3 mr-1" />Analytics
              </Button>
            </div>
          </div>

          {rightTab === 'intel' && selectedLead ? (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Lead Meta */}
                <div className="space-y-1.5 text-xs">
                  {[
                    ['Source', selectedLead.source],
                    ['Touches', selectedLead.outreach_count],
                    ['SMS Sent', selectedLead.sms_count || 0],
                    ['Last Outcome', selectedLead.last_outcome],
                    ['Last Contact', selectedLead.last_contacted_at ? format(new Date(selectedLead.last_contacted_at), 'MMM d, h:mm a') : null],
                    ['Next Step', selectedLead.next_step],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{val || '—'}</span></div>
                  ))}
                  {selectedLead.follow_up_at && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Follow-Up</span><span className="text-orange-400">{format(new Date(selectedLead.follow_up_at), 'MMM d, h:mm a')}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Owner Verified</span><span>{selectedLead.owner_verified ? '✅' : '❌'}</span></div>
                </div>

                {/* Onboarding Status */}
                {onboarding && (
                  <Card className="border-emerald-500/20">
                    <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-emerald-400">ONBOARDING</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className={onboarding.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : onboarding.status === 'sent' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {onboarding.status}
                        </Badge>
                      </div>
                      {onboarding.onboarding_link && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1 gap-1" onClick={() => copyToClipboard(onboarding.onboarding_link!, 'Onboarding link')}>
                            <LinkIcon className="h-3 w-3" /> Copy Link
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" disabled={sendOnboardingLink.isPending} onClick={() => sendOnboardingLink.mutate({
                            lead: selectedLead,
                            onboardingLink: onboarding.onboarding_link!,
                            onboardingId: onboarding.id,
                          })}>
                            <Send className="h-3 w-3" /> Resend
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* AI Score Reasons */}
                {selectedLead.ai_score_reasons?.length > 0 && (
                  <Card className="border-purple-500/20">
                    <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-purple-400">AI SCORE REASONS</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2">
                      {(selectedLead.ai_score_reasons as any[]).map((r: any, i: number) => (
                        <p key={i} className="text-[10px] text-muted-foreground">• {typeof r === 'string' ? r : JSON.stringify(r)}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedLead.notes && (
                  <Card className="border-border/30">
                    <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">NOTES</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2"><p className="text-xs">{selectedLead.notes}</p></CardContent>
                  </Card>
                )}

                {/* Outreach History */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">OUTREACH HISTORY ({logsCount})</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2">
                    {allLogs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No outreach yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {allLogs.map(log => (
                          <div key={log.id} className="bg-muted/20 rounded p-1.5">
                            <div className="flex justify-between text-[10px]">
                              <Badge variant="outline" className="text-[9px] h-4">{log.channel}</Badge>
                              <Badge className={`text-[9px] h-4 ${log.outcome === 'interested' || log.outcome === 'onboarded' ? 'bg-green-500/20 text-green-400' : log.outcome === 'not_interested' || log.outcome === 'wrong_number' ? 'bg-red-500/20 text-red-400' : ''}`}>{log.outcome}</Badge>
                            </div>
                            {log.notes && <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{log.notes}</p>}
                            {log.template_name && <p className="text-[9px] text-blue-400 mt-0.5">📱 {log.template_name}</p>}
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">{format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                          </div>
                        ))}
                        {hasMoreLogs && (
                          <Button variant="ghost" size="sm" className="w-full h-6 text-[10px]" onClick={() => fetchMoreLogs()}>
                            Load More
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="space-y-1.5">
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => updateLead.mutate({ id: selectedLead.id, owner_verified: true } as any)}>
                    <Shield className="h-3 w-3" /> Mark Owner Verified
                  </Button>
                  {selectedLead.status !== 'onboarded' && selectedLead.outreach_count >= 3 && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 text-purple-400" onClick={() => {
                      updateLead.mutate({ id: selectedLead.id, ai_call_eligible: true, ai_handoff_reason: `${selectedLead.outreach_count} attempts` } as any);
                      toast.success('Marked AI-call eligible');
                    }}>
                      <Bot className="h-3 w-3" /> Send to AI Queue
                    </Button>
                  )}
                  {selectedLead.status !== 'dead' && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 text-destructive" onClick={() => {
                      if (window.confirm('Mark this lead as dead?')) {
                        updateLead.mutate({ id: selectedLead.id, status: 'dead' } as any);
                      }
                    }}>
                      <X className="h-3 w-3" /> Mark Dead
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : rightTab === 'analytics' ? (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Funnel */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">LEAD FUNNEL</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1">
                    {['new', 'contacted', 'interested', 'callback', 'onboarded', 'dead'].map(status => {
                      const count = stats?.by_status?.[status] || 0;
                      const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center gap-2">
                          <span className="text-[10px] w-16 truncate capitalize">{status}</span>
                          <Progress value={pct} className="flex-1 h-1.5" />
                          <span className="text-[10px] font-mono w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Category conversion */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">CATEGORY CONVERSION</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1">
                    {stats?.by_category && Object.entries(stats.by_category)
                      .sort((a, b) => (b[1] as any).total - (a[1] as any).total)
                      .slice(0, 10)
                      .map(([cat, d]) => {
                        const catData = d as { total: number; onboarded: number };
                        return (
                        <div key={cat} className="flex items-center justify-between text-[10px]">
                          <span className="truncate capitalize w-20">{cat.replace(/_/g, ' ')}</span>
                          <span className="font-mono">{catData.onboarded}/{catData.total}</span>
                          <span className="font-mono text-green-400 w-10 text-right">{catData.total > 0 ? Math.round((catData.onboarded / catData.total) * 100) : 0}%</span>
                        </div>
                        );
                      })}
                  </CardContent>
                </Card>

                {/* Source breakdown */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">SOURCE BREAKDOWN</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1">
                    {stats?.by_source && Object.entries(stats.by_source)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([src, count]) => (
                        <div key={src} className="flex items-center justify-between text-[10px]">
                          <span className="capitalize">{src}</span>
                          <span className="font-mono">{count as number}</span>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                {/* Outcome distribution */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">OUTCOME DISTRIBUTION</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1">
                    {outcomeDist && Object.entries(outcomeDist)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([outcome, count]) => (
                        <div key={outcome} className="flex items-center justify-between text-[10px]">
                          <span className="truncate w-28">{outcome.replace(/_/g, ' ')}</span>
                          <span className="font-mono">{count}</span>
                        </div>
                      ))}
                  </CardContent>
                </Card>

                {/* KPIs */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">KEY METRICS</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1 text-[10px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Leads</span><span className="font-mono">{stats?.total || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg AI Score</span><span className="font-mono">{stats?.avg_score || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Avg Touches to Onboard</span><span className="font-mono">{stats?.avg_touches_to_onboard || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Today No-Answer %</span><span className="font-mono">{vaPerf?.no_answer_rate || 0}%</span></div>
                  </CardContent>
                </Card>

                {/* Top Cities */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">TOP CITIES</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-2 space-y-1">
                    {stats?.by_city && Object.entries(stats.by_city)
                      .sort((a, b) => (b[1] as any).total - (a[1] as any).total)
                      .slice(0, 8)
                      .map(([city, d]) => {
                        const cityData = d as { total: number; onboarded: number };
                        return (
                        <div key={city} className="flex items-center justify-between text-[10px]">
                          <span className="truncate w-24">{city}</span>
                          <span className="font-mono">{cityData.onboarded}/{cityData.total}</span>
                        </div>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center text-xs">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Select a lead to see intel</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
