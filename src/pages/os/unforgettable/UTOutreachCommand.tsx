import React, { useState, useMemo } from 'react';
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
import {
  Phone, MessageSquare, Mail, Bot, Plus, Search, TrendingUp, Users, Target,
  Zap, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle, X,
  ArrowRight, Send, Calendar, Star, Shield, RefreshCw
} from 'lucide-react';
import { format, isAfter, isBefore, isToday, addHours } from 'date-fns';
import {
  useUTPartnerLeads, useUTOutreachLogs, useUTLeadMutations, useUTLeadStats,
  useUTVAPerformance, UTPartnerLead
} from '@/hooks/useUTPartnerLeads';
import {
  UT_DISPOSITIONS, UTDispositionValue, UT_FOLLOW_UP_PRESETS,
  UT_SCRIPTS, UT_OBJECTIONS, UT_SMS_TEMPLATES, VA_DAILY_QUOTAS
} from '@/config/utScripts';
import { toast } from 'sonner';

// ── CATEGORIES ─────────────────────────────────────────────────────
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
  const [queueMode, setQueueMode] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedLead, setSelectedLead] = useState<UTPartnerLead | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Disposition state
  const [disposition, setDisposition] = useState<UTDispositionValue>('no_answer');
  const [callNotes, setCallNotes] = useState('');
  const [followUpPreset, setFollowUpPreset] = useState('');
  const [customFollowUp, setCustomFollowUp] = useState('');
  const [showScripts, setShowScripts] = useState(true);
  const [showObjections, setShowObjections] = useState(false);
  const [showSmsTemplates, setShowSmsTemplates] = useState(false);

  // Add lead state
  const [newLead, setNewLead] = useState({
    business_name: '', contact_name: '', category: 'other', phone: '', email: '', city: '', state: '', source: 'manual', notes: '',
  });

  // Queries
  const { data: leads = [], isLoading } = useUTPartnerLeads({
    queueMode: queueMode as any,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    search: searchText || undefined,
  });
  const { data: stats } = useUTLeadStats();
  const { data: vaPerf } = useUTVAPerformance();
  const { data: outreachLogs = [] } = useUTOutreachLogs(selectedLead?.id);
  const { createLead, saveCallDisposition, handoffToPartnerProfile, deleteLead, updateLead } = useUTLeadMutations();

  // Sort leads with callbacks at top
  const sortedLeads = useMemo(() => {
    const now = new Date();
    return [...leads].sort((a, b) => {
      // Overdue callbacks first
      if (a.callback_due_at && isBefore(new Date(a.callback_due_at), now)) return -1;
      if (b.callback_due_at && isBefore(new Date(b.callback_due_at), now)) return 1;
      // Due today next
      if (a.callback_due_at && isToday(new Date(a.callback_due_at))) return -1;
      if (b.callback_due_at && isToday(new Date(b.callback_due_at))) return 1;
      // Then by ai_score
      return (b.ai_score || 0) - (a.ai_score || 0);
    });
  }, [leads]);

  const currentScript = selectedLead ? UT_SCRIPTS[selectedLead.category] || UT_SCRIPTS.other : UT_SCRIPTS.other;
  const selectedDispo = UT_DISPOSITIONS.find(d => d.value === disposition);

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
        // Reset form
        setCallNotes('');
        setFollowUpPreset('');
        setCustomFollowUp('');
        setDisposition('no_answer');

        // Auto-handoff if onboarded
        if (result.disposition === 'onboarded') {
          handoffToPartnerProfile.mutate(selectedLead);
        }

        // Move to next lead
        const idx = sortedLeads.findIndex(l => l.id === selectedLead.id);
        if (idx < sortedLeads.length - 1) {
          setSelectedLead(sortedLeads[idx + 1]);
        }
      },
    });
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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* ── TOP BAR: Quota Progress ──────────────────────────────── */}
      <div className="border-b border-border/50 bg-card/50 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">🎉 VA Call Console</h1>
            <Badge variant="outline" className="text-[10px]">{leads.length} in queue</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Calls</span>
              <Progress value={(vaPerf?.callsMade || 0) / VA_DAILY_QUOTAS.calls * 100} className="w-20 h-1.5" />
              <span className="font-mono font-bold">{vaPerf?.callsMade || 0}/{VA_DAILY_QUOTAS.calls}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Connects</span>
              <Progress value={(vaPerf?.connected || 0) / VA_DAILY_QUOTAS.connects * 100} className="w-16 h-1.5" />
              <span className="font-mono font-bold">{vaPerf?.connected || 0}/{VA_DAILY_QUOTAS.connects}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">Interested</span>
              <span className="font-mono font-bold text-green-400">{vaPerf?.interested || 0}/{VA_DAILY_QUOTAS.interested}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">Onboarded</span>
              <span className="font-mono font-bold text-emerald-400">{vaPerf?.onboarded || 0}/{VA_DAILY_QUOTAS.onboarded}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Conv%</span>
              <span className="font-mono font-bold">{vaPerf?.conversionRate || 0}%</span>
            </div>
          </div>
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

      {/* ── 3-PANEL LAYOUT ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ═══ LEFT PANEL — CALL QUEUE ═══ */}
        <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
          {/* Queue Filters */}
          <div className="p-2 border-b border-border/30 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, city..."
                className="pl-8 h-8 text-xs"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUEUE_FILTERS.map(f => (
                <Button
                  key={f.value}
                  variant={queueMode === f.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => setQueueMode(f.value)}
                >
                  <f.icon className="h-3 w-3" />
                  {f.label}
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

          {/* Lead List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm"><RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />Loading...</div>
            ) : sortedLeads.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">No leads match filters</div>
            ) : (
              <div className="divide-y divide-border/20">
                {sortedLeads.map((lead, i) => (
                  <div
                    key={lead.id}
                    className={`p-2.5 cursor-pointer transition-colors hover:bg-muted/30 ${selectedLead?.id === lead.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{lead.business_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {lead.contact_name || 'No contact'} • {(lead.category || '').replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {lead.phone || 'No phone'} • {[lead.city, lead.state].filter(Boolean).join(', ') || 'No location'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`font-mono text-[10px] font-bold ${lead.ai_score >= 70 ? 'text-green-400' : lead.ai_score >= 40 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                          {lead.ai_score}
                        </span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${STATUS_COLORS[lead.status] || ''}`}>
                          {lead.status}
                        </Badge>
                        {getUrgencyBadge(lead)}
                      </div>
                    </div>
                    {lead.outreach_count > 0 && (
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {lead.outreach_count} touches • Last: {lead.last_outcome || '—'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
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
                        <p className="text-sm text-muted-foreground">
                          {selectedLead.contact_name || 'No contact name'} • {(selectedLead.category || '').replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[selectedLead.city, selectedLead.state].filter(Boolean).join(', ') || 'No location'}
                        </p>
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
                      <Button variant="outline" className="gap-1.5" onClick={() => toast.info('AI Call: queued for next iteration')}>
                        <Bot className="h-4 w-4" /> AI Call
                      </Button>
                    </>
                  ) : (
                    <div className="flex-1 text-center text-sm text-destructive bg-destructive/10 rounded-md py-2">
                      ⚠️ No phone number — cannot call
                    </div>
                  )}
                  {selectedLead.email && (
                    <Button variant="outline" className="gap-1.5" onClick={() => window.open(`mailto:${selectedLead.email}`)}>
                      <Mail className="h-4 w-4" /> Email
                    </Button>
                  )}
                </div>

                {/* SMS Templates */}
                {showSmsTemplates && (
                  <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>📱 SMS Templates</span>
                        <Button variant="ghost" size="sm" className="h-6" onClick={() => setShowSmsTemplates(false)}><X className="h-3.5 w-3.5" /></Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {UT_SMS_TEMPLATES.map(tpl => (
                        <div key={tpl.key} className="flex items-start justify-between gap-2 p-2 rounded bg-background/50 border border-border/20">
                          <div className="flex-1">
                            <p className="text-xs font-medium">{tpl.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.body}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                tpl.body
                                  .replace('[Contact Name]', selectedLead.contact_name || 'there')
                                  .replace('[Business Name]', selectedLead.business_name)
                                  .replace('[City]', selectedLead.city || 'your area')
                              );
                              toast.success(`${tpl.label} copied to clipboard`);
                            }}
                          >
                            <Send className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Script Panel */}
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
                        <div className="bg-background/50 rounded p-3 border border-border/20">
                          <p className="text-[10px] font-semibold text-pink-400 mb-1">OPENING</p>
                          <p className="italic">{currentScript.opening
                            .replace('[Business Name]', selectedLead.business_name)
                            .replace('[Contact Name]', selectedLead.contact_name || 'there')
                            .replace('[VA Name]', '[Your Name]')
                          }</p>
                        </div>
                        <div className="bg-background/50 rounded p-3 border border-border/20">
                          <p className="text-[10px] font-semibold text-pink-400 mb-1">VALUE PROPOSITION</p>
                          <p className="italic">{currentScript.value_prop
                            .replace('[City]', selectedLead.city || 'your area')
                          }</p>
                        </div>
                        <div className="bg-green-500/10 rounded p-3 border border-green-500/20">
                          <p className="text-[10px] font-semibold text-green-400 mb-1">CLOSE</p>
                          <p className="italic">{currentScript.close}</p>
                        </div>
                        <div className="bg-yellow-500/10 rounded p-3 border border-yellow-500/20">
                          <p className="text-[10px] font-semibold text-yellow-400 mb-1">VOICEMAIL</p>
                          <p className="italic text-xs">{currentScript.voicemail
                            .replace('[VA Name]', '[Your Name]')
                            .replace('[City]', selectedLead.city || 'your area')
                            .replace('[Number]', '[Your Number]')
                          }</p>
                        </div>
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
                          <div key={i} className="bg-background/50 rounded p-2.5 border border-border/20">
                            <p className="text-xs font-semibold text-amber-400">"{obj.trigger}"</p>
                            <p className="text-xs text-muted-foreground mt-1 italic">{obj.response
                              .replace('[category]', (selectedLead.category || '').replace(/_/g, ' '))
                              .replace('[city]', selectedLead.city || 'your area')
                            }</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>

                {/* ── DISPOSITION PANEL (STICKY) ──────────────────── */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm">📋 Call Disposition</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {/* Disposition Select */}
                    <Select value={disposition} onValueChange={v => setDisposition(v as UTDispositionValue)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UT_DISPOSITIONS.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Notes */}
                    <Textarea
                      placeholder="Call notes..."
                      value={callNotes}
                      onChange={e => setCallNotes(e.target.value)}
                      className="h-16 text-sm"
                    />

                    {/* Follow-up (if required) */}
                    {selectedDispo?.requireFollowUp && (
                      <div className="space-y-2">
                        <Label className="text-xs">Follow-Up Schedule {selectedDispo.requireFollowUp && '(Required)'}</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {UT_FOLLOW_UP_PRESETS.map(p => (
                            <Button
                              key={p.key}
                              variant={followUpPreset === p.key ? 'default' : 'outline'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setFollowUpPreset(p.key)}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>
                        {followUpPreset === 'custom' && (
                          <Input
                            type="datetime-local"
                            value={customFollowUp}
                            onChange={e => setCustomFollowUp(e.target.value)}
                            className="h-8"
                          />
                        )}
                      </div>
                    )}

                    {/* Save Button */}
                    <Button
                      className="w-full gap-2"
                      onClick={handleSaveDisposition}
                      disabled={saveCallDisposition.isPending}
                    >
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

        {/* ═══ RIGHT PANEL — INTELLIGENCE + HISTORY ═══ */}
        <div className="w-72 border-l border-border/50 flex flex-col bg-card/30 overflow-hidden">
          {selectedLead ? (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Lead Meta */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{selectedLead.source || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Touches</span><span className="font-mono">{selectedLead.outreach_count}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Outcome</span><span>{selectedLead.last_outcome || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last Contact</span><span>{selectedLead.last_contacted_at ? format(new Date(selectedLead.last_contacted_at), 'MMM d, h:mm a') : '—'}</span></div>
                  {selectedLead.follow_up_at && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Follow-Up</span><span className="text-orange-400">{format(new Date(selectedLead.follow_up_at), 'MMM d, h:mm a')}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">Owner Verified</span><span>{selectedLead.owner_verified ? '✅' : '❌'}</span></div>
                </div>

                {/* AI Score Reasons */}
                {selectedLead.ai_score_reasons && selectedLead.ai_score_reasons.length > 0 && (
                  <Card className="border-purple-500/20">
                    <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-purple-400">AI SCORE REASONS</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2">
                      <div className="space-y-1">
                        {(selectedLead.ai_score_reasons as any[]).map((r: any, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground">• {typeof r === 'string' ? r : JSON.stringify(r)}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {selectedLead.notes && (
                  <Card className="border-border/30">
                    <CardHeader className="py-1.5 px-3"><CardTitle className="text-[10px] text-muted-foreground">NOTES</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-2">
                      <p className="text-xs">{selectedLead.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Outreach History */}
                <Card className="border-border/30">
                  <CardHeader className="py-1.5 px-3">
                    <CardTitle className="text-[10px] text-muted-foreground">OUTREACH HISTORY ({outreachLogs.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-2">
                    {outreachLogs.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No outreach yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {outreachLogs.slice(0, 15).map(log => (
                          <div key={log.id} className="bg-muted/20 rounded p-1.5">
                            <div className="flex justify-between text-[10px]">
                              <Badge variant="outline" className="text-[9px] h-4">{log.channel}</Badge>
                              <Badge className={`text-[9px] h-4 ${
                                log.outcome === 'interested' || log.outcome === 'onboarded' ? 'bg-green-500/20 text-green-400' :
                                log.outcome === 'not_interested' || log.outcome === 'wrong_number' ? 'bg-red-500/20 text-red-400' : ''
                              }`}>{log.outcome}</Badge>
                            </div>
                            {log.notes && <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{log.notes}</p>}
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">{format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs gap-1"
                    onClick={() => updateLead.mutate({ id: selectedLead.id, owner_verified: true } as any)}
                  >
                    <Shield className="h-3 w-3" /> Mark Owner Verified
                  </Button>
                  {selectedLead.status !== 'onboarded' && selectedLead.outreach_count >= 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs gap-1 text-purple-400"
                      onClick={() => {
                        updateLead.mutate({
                          id: selectedLead.id,
                          ai_call_eligible: true,
                          ai_handoff_reason: `${selectedLead.outreach_count} attempts without conversion`,
                        } as any);
                        toast.success('Marked AI-call eligible');
                      }}
                    >
                      <Bot className="h-3 w-3" /> Send to AI Queue
                    </Button>
                  )}
                </div>
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
