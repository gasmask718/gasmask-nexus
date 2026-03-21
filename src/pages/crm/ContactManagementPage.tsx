import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Users, Brain, Bell, Search, Send, Phone, MapPin,
  Truck, Edit2, CheckCircle2, Loader2, Clock, Star,
  MessageSquare, AlertTriangle, Zap, X, Plus,
  ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ── Constants ─────────────────────────

const TIER_STYLES: Record<string, { badge: string; icon: string; label: string }> = {
  vip: { badge: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30', icon: '⭐', label: 'VIP' },
  active: { badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: '🟢', label: 'Active' },
  warm: { badge: 'bg-blue-500/15 text-blue-500 border-blue-500/30', icon: '🔵', label: 'Warm' },
  cold: { badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: '🧊', label: 'Cold' },
  at_risk: { badge: 'bg-red-500/15 text-red-500 border-red-500/30', icon: '🚨', label: 'At Risk' },
};

const BRAND_COLORS: Record<string, string> = {
  'GasMask': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Hot Mama Grabba': 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  'Grabba R Us': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'Hot Scalatti': 'bg-sky-500/15 text-sky-500 border-sky-500/30',
};

// ── Score bar ────────────────

function ScoreBar({ score, showNumber = true }: { score: number; showNumber?: boolean }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      {showNumber && <span className="text-[10px] text-muted-foreground w-5 text-right">{score}</span>}
    </div>
  );
}

// ── Draft Approval Card ────────────────

function DraftApprovalCard({ draft, onApprove, onEdit, onReject }: {
  draft: any; onApprove: () => void; onEdit: (msg: string) => void; onReject: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(draft.message_body);
  const meta = draft.metadata || {};

  return (
    <div className="p-3 rounded-lg border border-border bg-card space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{meta.store_name || draft.recipient || 'Unknown Store'}</p>
          <div className="flex gap-1.5 mt-0.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              🤖 {meta.agent || 'Relationship Agent'}
            </span>
            {meta.tier && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${TIER_STYLES[meta.tier]?.badge || ''}`}>
                {TIER_STYLES[meta.tier]?.icon} {meta.tier}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {draft.created_at ? formatDistanceToNow(new Date(draft.created_at), { addSuffix: true }) : ''}
        </span>
      </div>

      {editing ? (
        <textarea value={editText} onChange={e => setEditText(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" />
      ) : (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm italic">
          "{draft.message_body}"
        </div>
      )}

      {meta.cadence_decision?.reason && (
        <p className="text-[10px] text-muted-foreground">💡 {meta.cadence_decision.reason}</p>
      )}

      <div className="flex gap-2">
        {editing ? (
          <>
            <Button size="sm" className="flex-1 text-xs gap-1" onClick={() => { onEdit(editText); setEditing(false); }}>
              <Send className="h-3 w-3" /> Send Edited
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="sm" className="flex-1 text-xs gap-1" onClick={onApprove}>
              <Send className="h-3 w-3" /> Send
            </Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setEditing(true)}>
              <Edit2 className="h-3 w-3" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={onReject}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Contact Detail Panel ───────────────

function ContactDetailPanel({ contact, onClose }: { contact: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState(contact.personality_notes || '');
  const [preferences, setPreferences] = useState(contact.preferences || '');
  const [customMsg, setCustomMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);

  const tier = TIER_STYLES[contact.relationship_tier] || TIER_STYLES.warm;

  const { data: interactions = [] } = useQuery({
    queryKey: ['contact-interactions', contact.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('contact_interactions').select('*')
        .eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(15);
      return data || [];
    },
  });

  const { data: contactTasks = [] } = useQuery({
    queryKey: ['contact-tasks', contact.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('relationship_tasks').select('*')
        .eq('contact_id', contact.id).eq('status', 'pending').order('due_at', { ascending: true });
      return data || [];
    },
  });

  const saveNotes = async () => {
    await (supabase as any).from('contact_profiles').update({
      personality_notes: notes, preferences, updated_at: new Date().toISOString(),
    }).eq('id', contact.id);
    setEditMode(false);
    toast.success('Notes saved');
    queryClient.invalidateQueries({ queryKey: ['contact-profiles'] });
  };

  const generateMessage = async () => {
    setGeneratingMsg(true);
    try {
      const { data } = await supabase.functions.invoke('relationship-agent', {
        body: { action: 'write_vip_message', store_name: contact.business_name, owner_name: contact.owner_name, city: contact.city, message_type: 'check_in', context: notes || 'general check-in' }
      });
      setCustomMsg(data?.message || '');
    } catch (err: any) { toast.error(err.message); }
    finally { setGeneratingMsg(false); }
  };

  const sendMessage = async () => {
    if (!customMsg.trim() || !contact.phone_primary) return;
    setSending(true);
    try {
      await supabase.functions.invoke('send-sms', {
        body: { to_number: contact.phone_primary, message_body: customMsg, idempotency_key: `contact-${contact.id}-${Date.now()}` }
      });
      await (supabase as any).from('contact_interactions').insert({
        contact_id: contact.id, interaction_type: 'sms_sent', direction: 'outbound', content: customMsg, performed_by: 'human', performed_by_type: 'human', sentiment: 'neutral',
      });
      await (supabase as any).from('contact_profiles').update({
        last_contact_at: new Date().toISOString(), last_contact_type: 'sms', updated_at: new Date().toISOString(),
      }).eq('id', contact.id);
      setCustomMsg('');
      toast.success('Message sent');
      queryClient.invalidateQueries({ queryKey: ['contact-interactions', contact.id] });
    } catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold leading-tight">{contact.business_name}</h2>
            {contact.owner_name && <p className="text-sm text-muted-foreground">Owner: {contact.owner_name}</p>}
          </div>
          {contact.is_vip && <span className="text-2xl">⭐</span>}
        </div>
        <div className="flex gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tier.badge}`}>{tier.icon} {tier.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${BRAND_COLORS[contact.primary_brand] || ''}`}>{contact.primary_brand}</span>
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Relationship Health</span>
            <span className="font-medium">{contact.relationship_score || 0}/100</span>
          </div>
          <ScoreBar score={contact.relationship_score || 0} showNumber={false} />
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2">
        {contact.phone_primary && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={`tel:${contact.phone_primary}`} className="hover:underline">{contact.phone_primary}</a>
          </div>
        )}
        {contact.address && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">{contact.address}, {contact.city}, {contact.state}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <p className="text-muted-foreground text-[10px]">Last Contact</p>
            <p className="font-medium">{contact.last_contact_at ? formatDistanceToNow(new Date(contact.last_contact_at), { addSuffix: true }) : 'Never'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-[10px]">Next Follow-Up</p>
            <p className={`font-medium ${contact.next_followup_at && new Date(contact.next_followup_at) < new Date() ? 'text-red-500' : ''}`}>
              {contact.next_followup_at ? formatDistanceToNow(new Date(contact.next_followup_at), { addSuffix: true }) : 'Not set'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" className="gap-1.5 text-xs" onClick={generateMessage} disabled={generatingMsg}>
          {generatingMsg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />} AI Draft
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={async () => {
          await supabase.functions.invoke('gasmask-route-agent', {
            body: { action: 'create_trigger', store_name: contact.business_name, store_city: contact.city, store_state: contact.state, store_phone: contact.phone_primary, trigger_source: 'Contact Management', trigger_type: contact.relationship_tier === 'at_risk' ? 'urgent_visit' : 'follow_up', floor_source: 'floor1_crm', urgency: contact.relationship_tier === 'at_risk' ? 'critical' : 'normal', priority_score: contact.relationship_tier === 'at_risk' ? 9 : 5, trigger_notes: `From contact profile — ${contact.relationship_tier} account` }
          });
          toast.success('Visit triggered');
        }}>
          <Truck className="h-3.5 w-3.5" /> Schedule Visit
        </Button>
        {contact.phone_primary && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
            <a href={`tel:${contact.phone_primary}`}><Phone className="h-3.5 w-3.5" /> Call Now</a>
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditMode(!editMode)}>
          <Edit2 className="h-3.5 w-3.5" /> {editMode ? 'Cancel Edit' : 'Edit Profile'}
        </Button>
      </div>

      {/* Agent notes */}
      {contact.agent_notes && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-[10px] text-primary font-medium mb-1">🤖 Agent Notes</p>
          <p className="text-xs">{contact.agent_notes}</p>
        </div>
      )}

      {/* Personality notes edit */}
      {editMode ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Personality Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="How is the owner? Friendly? Strict?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Preferences & Notes</label>
            <textarea value={preferences} onChange={e => setPreferences(e.target.value)}
              placeholder="Best time to contact? Products they love?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" />
          </div>
          <Button size="sm" className="w-full" onClick={saveNotes}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Save Profile Notes
          </Button>
        </div>
      ) : contact.personality_notes && (
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-[10px] text-muted-foreground mb-1">Profile Notes</p>
          <p className="text-sm">{contact.personality_notes}</p>
          {contact.preferences && <p className="text-xs text-muted-foreground mt-2">{contact.preferences}</p>}
        </div>
      )}

      {/* Message composer */}
      <div className="space-y-2">
        <p className="text-xs font-medium">Send Message</p>
        <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
          placeholder="Type or AI-draft a message..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]" />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={sendMessage}
            disabled={sending || !customMsg.trim() || !contact.phone_primary}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send SMS
          </Button>
          {!contact.phone_primary && <p className="text-xs text-red-400 self-center">No phone number</p>}
        </div>
      </div>

      {/* Pending tasks */}
      {contactTasks.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2">Pending Agent Tasks</p>
          <div className="space-y-2">
            {contactTasks.map((task: any) => (
              <div key={task.id} className="text-xs p-2 rounded-lg border bg-muted/30">
                <p className="font-medium">{task.title}</p>
                {task.ai_suggested_message && <p className="text-muted-foreground mt-1 italic">"{task.ai_suggested_message}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interaction timeline */}
      <div>
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Interaction History
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {interactions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No interactions logged yet</p>
          ) : interactions.map((i: any) => (
            <div key={i.id} className={`flex gap-2 text-xs pl-3 py-1.5 border-l-2 ${i.direction === 'inbound' ? 'border-l-blue-400' : 'border-l-emerald-400'}`}>
              <div className="flex-1">
                <span className="font-medium capitalize">{i.interaction_type?.replace(/_/g, ' ')}</span>{' '}
                <span className="text-muted-foreground text-[10px]">via {i.performed_by_type}</span>
                {i.content && <p className="text-muted-foreground mt-0.5 line-clamp-2">{i.content}</p>}
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                {i.created_at ? formatDistanceToNow(new Date(i.created_at), { addSuffix: true }) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────

export default function ContactManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'contacts' | 'approvals' | 'tasks'>('contacts');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [selectedContact, setSelected] = useState<any>(null);
  const [runningAgent, setRunningAgent] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  // ── Queries ────────────────────────

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contact-profiles', tierFilter, brandFilter, search],
    queryFn: async () => {
      let q = (supabase as any).from('contact_profiles').select('*').eq('is_active', true)
        .order('relationship_score', { ascending: true });
      if (tierFilter !== 'all' && tierFilter !== 'overdue') q = q.eq('relationship_tier', tierFilter);
      if (tierFilter === 'overdue') q = q.lt('next_followup_at', new Date().toISOString());
      if (brandFilter !== 'all') q = q.eq('primary_brand', brandFilter);
      if (search) q = q.ilike('business_name', `%${search}%`);
      const { data } = await q.limit(500);
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: pendingDrafts = [] } = useQuery({
    queryKey: ['communication-drafts-pending'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('communication_drafts').select('*')
        .eq('status', 'draft').eq('requires_approval', true)
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['relationship-tasks-pending'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('relationship_tasks').select('*')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Realtime for drafts
  useEffect(() => {
    const ch = supabase.channel('drafts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_drafts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['communication-drafts-pending'] });
        toast.info('New draft message ready');
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // ── Stats ──────────────────────────
  const allContacts = contacts as any[];
  const vipCount = allContacts.filter(c => c.relationship_tier === 'vip').length;
  const activeCount = allContacts.filter(c => c.relationship_tier === 'active').length;
  const warmCount = allContacts.filter(c => c.relationship_tier === 'warm').length;
  const coldCount = allContacts.filter(c => c.relationship_tier === 'cold').length;
  const atRiskCount = allContacts.filter(c => c.relationship_tier === 'at_risk').length;
  const overdueCount = allContacts.filter(c => c.next_followup_at && new Date(c.next_followup_at) < new Date()).length;

  // ── Actions ────────────────────────

  const runAgent = async () => {
    setRunningAgent(true);
    try {
      const { data, error } = await supabase.functions.invoke('relationship-agent', {
        body: { action: 'run_daily_relationship_cycle', limit: 50 }
      });
      if (error) throw error;
      toast.success('Relationship cycle complete', {
        description: `${data?.processed || 0} stores · ${data?.contacted || 0} contacted · ${data?.skipped || 0} skipped`,
        duration: 8000,
      });
      queryClient.invalidateQueries({ queryKey: ['contact-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['communication-drafts-pending'] });
    } catch (err: any) { toast.error(err.message); }
    finally { setRunningAgent(false); }
  };

  const approveDraft = async (draft: any, customMessage?: string) => {
    const msgToSend = customMessage || draft.message_body;
    const phone = draft.recipient;
    if (!phone) { toast.error('No phone number'); return; }
    try {
      await supabase.functions.invoke('send-sms', {
        body: { to_number: phone, message_body: msgToSend, idempotency_key: `draft-${draft.id}` }
      });
      await (supabase as any).from('communication_drafts').update({
        status: 'sent', sent_at: new Date().toISOString(), message_body: msgToSend,
      }).eq('id', draft.id);

      if (draft.entity_id) {
        const { data: contact } = await (supabase as any).from('contact_profiles').select('id').eq('store_id', draft.entity_id).maybeSingle();
        if (contact) {
          await (supabase as any).from('contact_interactions').insert({
            contact_id: contact.id, interaction_type: 'sms_sent', direction: 'outbound', content: msgToSend, performed_by: 'Relationship Agent', performed_by_type: 'agent',
          });
          await (supabase as any).from('contact_profiles').update({
            last_contact_at: new Date().toISOString(), last_contact_type: 'sms', updated_at: new Date().toISOString(),
          }).eq('id', contact.id);
        }
      }
      toast.success('Message sent!');
      queryClient.invalidateQueries({ queryKey: ['communication-drafts-pending'] });
    } catch (err: any) { toast.error(err.message); }
  };

  const rejectDraft = async (id: string) => {
    await (supabase as any).from('communication_drafts').update({ status: 'rejected' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['communication-drafts-pending'] });
    toast.info('Draft rejected');
  };

  const paginated = allContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(allContacts.length / PAGE_SIZE);

  // ── KPI stat cards data ────────
  const kpiCards = [
    { label: 'Total', count: allContacts.length, color: 'text-foreground', tier: 'all' },
    { label: '⭐ VIP', count: vipCount, color: 'text-yellow-500', tier: 'vip' },
    { label: '🟢 Active', count: activeCount, color: 'text-emerald-500', tier: 'active' },
    { label: '🔵 Warm', count: warmCount, color: 'text-blue-500', tier: 'warm' },
    { label: '🧊 Cold', count: coldCount, color: 'text-slate-400', tier: 'cold' },
    { label: '🚨 At Risk', count: atRiskCount, color: 'text-red-500', tier: 'at_risk' },
    { label: '⏰ Overdue', count: overdueCount, color: 'text-amber-500', tier: 'overdue' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* HEADER */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Contact Management
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI relationship specialists keeping every store warm</p>
          </div>
          <div className="flex gap-2">
            {pendingDrafts.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setActiveTab('approvals')} className="gap-1.5 text-xs relative">
                <Bell className="h-3.5 w-3.5" /> Approvals
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">{pendingDrafts.length}</span>
              </Button>
            )}
            <Button size="sm" onClick={runAgent} disabled={runningAgent} className="gap-1.5 text-xs">
              {runningAgent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />} Run Relationship Agent
            </Button>
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="flex-shrink-0 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {kpiCards.map(stat => (
            <button key={stat.tier} onClick={() => { setTierFilter(stat.tier); setPage(1); }}
              className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-all text-center min-w-[88px] ${tierFilter === stat.tier ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50'}`}>
              <span className={`text-2xl font-bold block ${stat.color}`}>{stat.count}</span>
              <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            </button>
          ))}
          {pendingDrafts.length > 0 && (
            <button onClick={() => setActiveTab('approvals')}
              className="flex-shrink-0 px-4 py-2 rounded-lg border border-primary/50 bg-primary/5 transition-all text-center min-w-[88px] animate-pulse">
              <span className="text-2xl font-bold block text-primary">{pendingDrafts.length}</span>
              <span className="text-[10px] text-muted-foreground">✍️ Awaiting</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex-shrink-0 px-4 flex gap-1 border-b border-border">
        {([
          { key: 'contacts', label: 'Contacts', icon: Users },
          { key: 'approvals', label: `Approvals${pendingDrafts.length ? ` (${pendingDrafts.length})` : ''}`, icon: Bell },
          { key: 'tasks', label: `Tasks${pendingTasks.length ? ` (${pendingTasks.length})` : ''}`, icon: CheckCircle2 },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contacts' && (
          <div className="p-4 space-y-3">
            {/* Filter bar */}
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search contacts..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-8 w-48 pl-7 text-xs" />
              </div>
              <Select value={brandFilter} onValueChange={v => { setBrandFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  <SelectItem value="GasMask">GasMask</SelectItem>
                  <SelectItem value="Hot Mama Grabba">Hot Mama</SelectItem>
                  <SelectItem value="Grabba R Us">Grabba R Us</SelectItem>
                  <SelectItem value="Hot Scalatti">Hot Scalatti</SelectItem>
                </SelectContent>
              </Select>
              {(search || tierFilter !== 'all' || brandFilter !== 'all') && (
                <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => { setSearch(''); setTierFilter('all'); setBrandFilter('all'); setPage(1); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{allContacts.length} contacts</span>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : allContacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No contacts found</p></div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="p-2.5 font-medium">Store</th>
                        <th className="p-2.5 font-medium">Brand</th>
                        <th className="p-2.5 font-medium">Location</th>
                        <th className="p-2.5 font-medium">Tier</th>
                        <th className="p-2.5 font-medium w-28">Score</th>
                        <th className="p-2.5 font-medium">Last Contact</th>
                        <th className="p-2.5 font-medium">Next Follow-Up</th>
                        <th className="p-2.5 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((contact: any) => {
                        const tier = TIER_STYLES[contact.relationship_tier] || TIER_STYLES.warm;
                        const isOverdue = contact.next_followup_at && new Date(contact.next_followup_at) < new Date();
                        return (
                          <tr key={contact.id}
                            className={`border-t border-border hover:bg-muted/30 cursor-pointer transition-colors ${contact.relationship_tier === 'at_risk' ? 'border-l-2 border-l-red-500' : contact.relationship_tier === 'vip' ? 'border-l-2 border-l-yellow-500' : ''}`}
                            onClick={() => setSelected(contact)}>
                            <td className="p-2.5">
                              <p className="font-medium text-sm leading-tight">{contact.business_name}</p>
                              {contact.owner_name && <p className="text-[10px] text-muted-foreground">{contact.owner_name}</p>}
                            </td>
                            <td className="p-2.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${BRAND_COLORS[contact.primary_brand] || 'bg-muted text-muted-foreground border-border'}`}>
                                {contact.primary_brand || 'GasMask'}
                              </span>
                            </td>
                            <td className="p-2.5 text-xs text-muted-foreground">
                              {[contact.city, contact.state].filter(Boolean).join(', ')}
                              {contact.boro && <span className="block text-[10px]">{contact.boro}</span>}
                            </td>
                            <td className="p-2.5">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${tier.badge}`}>{tier.icon} {tier.label}</span>
                            </td>
                            <td className="p-2.5 w-28"><ScoreBar score={contact.relationship_score || 0} /></td>
                            <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {contact.last_contact_at ? formatDistanceToNow(new Date(contact.last_contact_at), { addSuffix: true }) : 'Never'}
                            </td>
                            <td className={`p-2.5 text-xs whitespace-nowrap ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              {contact.next_followup_at ? formatDistanceToNow(new Date(contact.next_followup_at), { addSuffix: true }) : '—'}
                              {isOverdue && ' ⚠️'}
                            </td>
                            <td className="p-2.5" onClick={e => e.stopPropagation()}>
                              <button className="text-[10px] px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" onClick={() => setSelected(contact)}>View →</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <Button size="sm" variant="outline" className="text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button size="sm" variant="outline" className="text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Messages Awaiting Approval
              </h2>
              <span className="text-xs text-muted-foreground">{pendingDrafts.length} pending</span>
            </div>
            {pendingDrafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pending approvals</p>
                <p className="text-xs mt-1">Run the Relationship Agent to generate messages</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-2xl">
                {pendingDrafts.map((draft: any) => (
                  <DraftApprovalCard key={draft.id} draft={draft}
                    onApprove={() => approveDraft(draft)}
                    onEdit={(msg) => approveDraft(draft, msg)}
                    onReject={() => rejectDraft(draft.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Relationship Tasks
              </h2>
              <span className="text-xs text-muted-foreground">{pendingTasks.length} pending</span>
            </div>
            {pendingTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All tasks completed</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl">
                {pendingTasks.map((task: any) => (
                  <div key={task.id} className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                      </div>
                      <Badge variant={task.priority === 'critical' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'} className="text-[9px]">
                        {task.priority}
                      </Badge>
                    </div>
                    {task.ai_suggested_message && (
                      <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs italic">"{task.ai_suggested_message}"</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs" onClick={async () => {
                        await (supabase as any).from('relationship_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id);
                        queryClient.invalidateQueries({ queryKey: ['relationship-tasks-pending'] });
                        toast.success('Task completed');
                      }}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL SHEET */}
      <Sheet open={!!selectedContact} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedContact?.business_name}</SheetTitle>
          </SheetHeader>
          {selectedContact && <ContactDetailPanel contact={selectedContact} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
