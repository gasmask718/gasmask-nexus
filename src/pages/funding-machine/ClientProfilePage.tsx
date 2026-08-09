import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import {
  User, Building2, Target, Shield, CreditCard, TrendingUp,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, RefreshCw,
  ExternalLink, FileText, Send, Award, Search, Loader2, Sparkles
} from "lucide-react";
import DocumentVault from "@/components/funding-machine/DocumentVault";
import ScoreSimulator from "@/components/funding-machine/ScoreSimulator";
import LenderRelationships from "@/components/funding-machine/LenderRelationships";
import AutoFillApplicationDialog from "@/components/funding-machine/AutoFillApplicationDialog";
import { FUNDING_CLIENT_SAFE_COLUMNS } from '@/lib/funding/pii';

const GOLD = "#C9A84C";

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const DFS_DIMENSIONS = [
  { key: 'personal_credit_tu', label: 'Personal Credit (TU)', max: 10 },
  { key: 'personal_credit_eq', label: 'Personal Credit (EQ)', max: 10 },
  { key: 'personal_credit_ex', label: 'Personal Credit (EX)', max: 10 },
  { key: 'business_credit_age', label: 'Business Credit Age', max: 8 },
  { key: 'tradeline_density', label: 'Tradeline Density', max: 8 },
  { key: 'derogatory_count', label: 'Derogatory Items', max: 10 },
  { key: 'utilization_ratio', label: 'Utilization Ratio', max: 8 },
  { key: 'public_records', label: 'Public Records', max: 6 },
  { key: 'inquiry_velocity', label: 'Inquiry Velocity', max: 6 },
  { key: 'entity_quality', label: 'Entity Structure', max: 8 },
  { key: 'ein_age', label: 'EIN Age', max: 6 },
  { key: 'banking_history', label: 'Banking History', max: 10 },
  { key: 'revenue_docs', label: 'Revenue Documentation', max: 5 },
  { key: 'industry_risk', label: 'Industry Risk Profile', max: 5 },
];

const INFRA_GUIDES: Record<string, { description: string; providers?: string[]; url?: string }> = {
  business_address: {
    description: 'Set up a virtual office or mailbox with a real street address. This address will be used on LLC, EIN, bank accounts, and all applications.',
    providers: ['iPostal1', 'Anytime Mailbox', 'Alliance Virtual Offices', 'Opus Virtual Offices', 'Regus'],
    url: 'https://www.ipostal1.com',
  },
  entity_formation: {
    description: 'Form an LLC or corporation in your target state. Use the business address from Step 1 on all formation documents.',
    providers: ['Northwest Registered Agents', 'IncFile', 'LegalZoom'],
  },
  ein_registration: {
    description: 'Apply for an EIN at irs.gov/businesses. Download the confirmation letter immediately and store it in your document vault.',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
  },
  duns_number: {
    description: 'Register at dnb.com to establish your D&B file. Required for Tier 1 vendor tradelines. Allow 30 days for activation.',
    url: 'https://www.dnb.com/duns-number/get-a-duns.html',
  },
  business_banking: {
    description: 'Open Mercury or Relay as primary business checking. Fund with minimum $500 on day one. These banks are directly verified by Bluevine and Fundbox.',
    providers: ['Mercury', 'Relay', 'Novo'],
    url: 'https://mercury.com',
  },
  directory_411: {
    description: 'List your business phone in the 411 directory. Lenders verify this during underwriting.',
    url: 'https://www.listyourself.net',
  },
  website_email: {
    description: 'Set up a professional domain email and basic business website. Lenders Google every business during underwriting.',
    providers: ['Google Domains', 'Namecheap', 'Squarespace', 'Wix'],
  },
};

export default function ClientProfilePage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['funding-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select(FUNDING_CLIENT_SAFE_COLUMNS).eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: dfsScores = [] } = useQuery({
    queryKey: ['funding-dfs', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_dfs_scores').select('*').eq('client_id', clientId).order('scored_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ['funding-checklist', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_infrastructure_checklist').select('*').eq('client_id', clientId).order('step_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: negativeItems = [] } = useQuery({
    queryKey: ['client-negative-items', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('funding_credit_items' as any)
        .select('id, current_status, is_resolved')
        .eq('client_id', clientId as any)
        .eq('is_resolved', false as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!clientId,
  });


  // ==== Notes / Reminders / Score History state ====
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteType, setNoteType] = useState('general');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notesPinned, setNotesPinned] = useState(false);
  const [notesFilter, setNotesFilter] = useState('all');
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderType, setReminderType] = useState('task');
  const [reminderDue, setReminderDue] = useState('');
  const [reminderPriority, setReminderPriority] = useState('medium');

  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreTU, setScoreTU] = useState('');
  const [scoreEQ, setScoreEQ] = useState('');
  const [scoreEX, setScoreEX] = useState('');
  const [scoreDate, setScoreDate] = useState(new Date().toISOString().split('T')[0]);

  // ==== Bureau Response Tracking state ====
  const [bureauTracking, setBureauTracking] = useState<any[]>([]);
  const [bureauLoading, setBureauLoading] = useState(true);
  const [showBureauModal, setShowBureauModal] = useState(false);
  const [newBureau, setNewBureau] = useState('TransUnion');
  const [newLetterDate, setNewLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [newCertifiedMail, setNewCertifiedMail] = useState('');

  const [clientStage, setClientStage] = useState('intake');

  const [lenderMatches, setLenderMatches] = useState<any[]>([]);
  const [lendersLoading, setLendersLoading] = useState(true);
  const [applyingLender, setApplyingLender] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);

  const loadLenderMatches = async () => {
    setLendersLoading(true);
    const { data } = await (supabase.from('funding_client_lender_matches' as any) as any)
      .select(`
        *,
        funding_lender_database:lender_id(
          lender_name, product_name, category, max_amount,
          prequal_url, has_soft_pull_prequal, product_type
        )
      `)
      .eq('client_id', clientId)
      .order('match_score', { ascending: false });
    const enriched = (data ?? []).map((r: any) => ({ ...r, ...(r.funding_lender_database ?? {}) }));
    setLenderMatches(enriched);
    setLendersLoading(false);
  };

  const handleApplyLender = async (matchId: string) => {
    setApplyingLender(matchId);
    try {
      const { data, error } = await supabase.functions.invoke('submit-lender-application', {
        body: { client_id: clientId, lender_match_id: matchId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Applied to ${(data as any)?.lender_name ?? 'lender'}`);
      loadLenderMatches();
      loadNotesAndReminders();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApplyingLender(null);
    }
  };

  const handleApplyTop3 = async () => {
    setApplyingAll(true);
    try {
      const top3 = lenderMatches.filter(m => m.status === 'identified').slice(0, 3);
      for (const match of top3) {
        await supabase.functions.invoke('submit-lender-application', {
          body: { client_id: clientId, lender_match_id: match.id },
        });
      }
      toast.success(`Applied to top ${top3.length} lenders`);
      loadLenderMatches();
      loadNotesAndReminders();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApplyingAll(false);
    }
  };

  const loadNotesAndReminders = async () => {
    const [notesRes, remindersRes] = await Promise.all([
      (supabase.from('client_notes' as any).select('*').eq('client_id', clientId as any)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })),
      (supabase.from('client_reminders' as any).select('*').eq('client_id', clientId as any)
        .order('due_date', { ascending: true })),
    ]);
    setNotes((notesRes as any).data ?? []);
    setNotesLoading(false);
    setReminders((remindersRes as any).data ?? []);
    setRemindersLoading(false);
  };

  const loadScoreHistory = async () => {
    const { data } = await (supabase.from('client_score_history' as any)
      .select('*').eq('client_id', clientId as any).order('score_date', { ascending: true }));
    setScoreHistory((data as any) ?? []);
    setScoreLoading(false);
  };

  const loadClientStage = async () => {
    const { data } = await supabase.from('funding_clients')
      .select('stage, score_tu, score_eq, score_ex').eq('id', clientId!).single();
    if (data) setClientStage((data as any).stage ?? 'intake');
  };

  const loadBureauTracking = async () => {
    const { data } = await (supabase.from('bureau_response_tracking' as any)
      .select('*').eq('client_id', clientId as any)
      .order('letter_sent_date', { ascending: false }));
    setBureauTracking((data as any) ?? []);
    setBureauLoading(false);
  };

  const handleLogLetter = async () => {
    const { error } = await (supabase.from('bureau_response_tracking' as any).insert({
      client_id: clientId,
      bureau: newBureau,
      letter_sent_date: newLetterDate,
      certified_mail_number: newCertifiedMail.trim() || null,
    } as any));
    if (error) { toast.error(error.message); return; }
    toast.success('Letter logged for ' + newBureau);
    setShowBureauModal(false);
    setNewCertifiedMail('');
    loadBureauTracking();
  };

  const handleMarkResponse = async (id: string, responseType: string) => {
    await (supabase.from('bureau_response_tracking' as any).update({
      response_received_date: new Date().toISOString().split('T')[0],
      response_type: responseType,
    } as any).eq('id', id));
    loadBureauTracking();
    toast.success('Response recorded');
  };

  useEffect(() => {
    if (!clientId) return;
    loadNotesAndReminders();
    loadScoreHistory();
    loadClientStage();
    loadBureauTracking();
    loadLenderMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    const { error } = await (supabase.from('client_notes' as any).insert({
      client_id: clientId, note_type: noteType,
      title: noteTitle.trim() || null, content: noteContent.trim(),
      is_pinned: notesPinned, created_by: 'David',
    } as any));
    if (error) { toast.error(error.message); return; }
    toast.success('Note added');
    setNoteTitle(''); setNoteContent(''); setNotesPinned(false); setShowNoteModal(false);
    loadNotesAndReminders();
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('client_notes' as any).delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.success('Note deleted');
  };

  const handleAddReminder = async () => {
    if (!reminderTitle.trim() || !reminderDue) return;
    const { error } = await (supabase.from('client_reminders' as any).insert({
      client_id: clientId, title: reminderTitle.trim(),
      reminder_type: reminderType, due_date: reminderDue,
      priority: reminderPriority, is_completed: false,
    } as any));
    if (error) { toast.error(error.message); return; }
    toast.success('Reminder added');
    setReminderTitle(''); setReminderDue(''); setShowReminderModal(false);
    loadNotesAndReminders();
  };

  const handleCompleteReminder = async (id: string, current: boolean) => {
    await (supabase.from('client_reminders' as any).update({
      is_completed: !current,
      completed_at: !current ? new Date().toISOString() : null,
    } as any).eq('id', id));
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: !current } : r));
  };

  const handleDeleteReminder = async (id: string) => {
    await supabase.from('client_reminders' as any).delete().eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  const handleAddScore = async () => {
    if (!scoreTU && !scoreEQ && !scoreEX) return;
    const { error } = await (supabase.from('client_score_history' as any).upsert({
      client_id: clientId, score_date: scoreDate,
      score_tu: scoreTU ? parseInt(scoreTU) : null,
      score_eq: scoreEQ ? parseInt(scoreEQ) : null,
      score_ex: scoreEX ? parseInt(scoreEX) : null,
      source: 'manual',
    } as any, { onConflict: 'client_id,score_date' }));
    if (error) { toast.error(error.message); return; }
    toast.success('Score updated');
    setScoreTU(''); setScoreEQ(''); setScoreEX(''); setShowScoreModal(false);
    loadScoreHistory();
  };



  // ---- Grants tab ----
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const { data: eligibility, refetch: refetchEligibility } = useQuery({
    queryKey: ['funding-client-grant-eligibility', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_clients')
        .select('grant_eligible, grant_checked_at')
        .eq('id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as { grant_eligible: boolean | null; grant_checked_at: string | null } | null;
    },
    enabled: !!clientId,
  });

  const { data: grantMatches = [], refetch: refetchMatches } = useQuery({
    queryKey: ['funding-client-grant-matches', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_grant_matches')
        .select('*')
        .eq('client_id', clientId!)
        .neq('status', 'ineligible')
        .order('eligibility_score', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const { data: activeApps = [], refetch: refetchActiveApps } = useQuery({
    queryKey: ['funding-client-grant-active', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grant_applications')
        .select('id, grant_name, funder_name, status, amount_requested, deadline')
        .eq('funding_client_id', clientId!)
        .not('status', 'in', '(awarded,denied,closed)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const { data: wonApps = [], refetch: refetchWon } = useQuery({
    queryKey: ['funding-client-grant-won', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grant_applications')
        .select('id, grant_name, funder_name, amount_awarded, award_date')
        .eq('funding_client_id', clientId!)
        .eq('status', 'awarded')
        .order('award_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const refetchGrantData = () => {
    refetchEligibility();
    refetchMatches();
    refetchActiveApps();
    refetchWon();
  };

  const handleCheckEligibility = async () => {
    setCheckingEligibility(true);
    const { data, error } = await supabase.functions.invoke('grant-eligibility-check', {
      body: { client_id: clientId },
    });
    setCheckingEligibility(false);
    if (error) { toast.error(error.message); return; }
    const result = data as any;
    if (result?.error) { toast.error(result.error); return; }
    toast.success(
      `${result.eligible_count ?? 0} grants found! Up to $${(result.total_available ?? 0).toLocaleString()} available.`
    );
    refetchGrantData();
  };

  const handleStartApplication = async (m: any) => {
    const { data: newApp, error } = await supabase
      .from('grant_applications')
      .insert({
        funding_client_id: clientId,
        grant_name: m.grant_name,
        funder_name: m.funder_name,
        amount_requested: m.grant_amount,
        deadline: m.deadline,
        status: 'drafting',
        applicant_type: 'funding_client',
        opportunity_id: m.opportunity_id ?? null,
      })
      .select('id')
      .single();
    if (error || !newApp) { toast.error(error?.message || 'Failed'); return; }
    toast.success('Application started!');
    navigate(`/os/grants/${newApp.id}`);
  };

  const handleSkipMatch = async (matchId: string) => {
    const { error } = await supabase
      .from('client_grant_matches')
      .update({ status: 'ineligible' })
      .eq('id', matchId);
    if (error) { toast.error(error.message); return; }
    refetchMatches();
  };


  const toggleStep = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase.from('funding_infrastructure_checklist').update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-checklist', clientId] });
      toast.success('Step updated');
    },
  });

  const latestDFS = dfsScores[0];
  const completedSteps = checklist.filter(s => s.status === 'completed').length;

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );

  if (!client) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Client not found</p>
      <Button onClick={() => navigate('/funding-machine')} className="mt-4">Back to Dashboard</Button>
    </div>
  );

  const sendPortalInvite = async () => {
    if (!client?.email) { toast.error('Client email required'); return; }
    try {
      await supabase.from('funding_clients').update({ portal_invite_sent_at: new Date().toISOString() }).eq('id', clientId);
      toast.success(`Portal invite will be sent to ${client.email}`);
      queryClient.invalidateQueries({ queryKey: ['funding-client', clientId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const runBrain = async (type: 'credit' | 'lenders' | 'grants') => {
    setRunning(type);
    try {
      const fnMap = {
        credit: 'credit-analysis-brain',
        lenders: 'lender-matching-engine',
        grants: 'strategic-grant-brain',
      };
      const { data, error } = await supabase.functions.invoke(fnMap[type], {
        body: { client_id: clientId },
      });
      if (error) throw error;
      const analysis = type === 'credit' ? data.analysis : data.strategy;
      setLastAnalysis(analysis ?? '');
      toast.success(
        type === 'credit'
          ? 'Credit analysis complete'
          : type === 'lenders'
            ? `${data.matched_count ?? 0} lenders matched`
            : 'Grant plan generated'
      );
      loadNotesAndReminders();
    } catch (e: any) {
      toast.error(e.message ?? 'Brain call failed');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.first_name} {client.last_name}</h1>
            <p className="text-muted-foreground">{client.business_name || 'No business entity'} • {client.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {negativeItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={() => navigate(`/funding-machine/credit-repair?client=${clientId}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Dispute Letters
              <Badge className="ml-2 bg-red-500/20 text-red-300 border-red-500/40">
                {negativeItems.length}
              </Badge>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={sendPortalInvite} className="border-amber-500/30 text-amber-400">
            <Send className="h-3 w-3 mr-1" /> Send Portal Invite
          </Button>
          <Button
            size="sm"
            onClick={() => setAutofillOpen(true)}
            style={{ backgroundColor: "#C9A84C", color: "#000" }}
          >
            <Sparkles className="h-3 w-3 mr-1" /> Auto-Fill Application
          </Button>
          <select
            value={client.status || 'new'}
            onChange={async (e) => {
              const newStatus = e.target.value;
              const { error } = await supabase
                .from('funding_clients')
                .update({ status: newStatus })
                .eq('id', clientId);
              if (error) {
                toast.error(`Failed to update status: ${error.message}`);
              } else {
                toast.success(`Status updated to ${newStatus}`);
                queryClient.invalidateQueries({ queryKey: ['funding-client', clientId] });
              }
            }}
            className="rounded-md border border-amber-500/30 bg-background text-amber-400 text-sm px-3 py-1.5 font-semibold cursor-pointer hover:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="new">New</option>
            <option value="intake">Intake</option>
            <option value="in_review">In Review</option>
            <option value="active">Active</option>
            <option value="approved">Approved</option>
            <option value="funded">Funded</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Badge variant="outline" className={
            client.status === 'active' || client.status === 'approved' || client.status === 'funded' ? 'border-emerald-500/30 text-emerald-500 text-lg px-4 py-1' :
            client.status === 'rejected' || client.status === 'cancelled' ? 'border-red-500/30 text-red-500 text-lg px-4 py-1' :
            'border-amber-500/30 text-amber-500 text-lg px-4 py-1'
          }>
            {client.status}
          </Badge>
        </div>

      </div>

      <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span>🧠</span>
            AI Strategic Brain
          </h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                await runBrain('credit');
                await runBrain('lenders');
                await runBrain('grants');
              }}
              disabled={running !== null}
              className="px-3 py-1.5 text-xs bg-background border border-[#C9A84C]/40 text-[#C9A84C] rounded font-medium hover:bg-[#C9A84C]/10 disabled:opacity-50 transition"
            >
              {running !== null ? '⏳ Running...' : '⚡ Run All'}
            </button>
            <button
              onClick={() => runBrain('credit')}
              disabled={running === 'credit'}
              className="px-3 py-1.5 text-xs bg-[#C9A84C] text-black rounded font-medium hover:bg-[#B8963E] disabled:opacity-50 transition"
            >
              {running === 'credit' ? '🧠 Analyzing...' : '🧠 Credit Analysis'}
            </button>
            <button
              onClick={() => runBrain('lenders')}
              disabled={running === 'lenders'}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {running === 'lenders' ? '💰 Matching...' : '💰 Match Lenders'}
            </button>
            <button
              onClick={() => runBrain('grants')}
              disabled={running === 'grants'}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded font-medium hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {running === 'grants' ? '🏆 Planning...' : '🏆 Grant Plan'}
            </button>
          </div>
        </div>
        {lastAnalysis ? (
          <div className="bg-background/60 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto border border-border/50">
            {lastAnalysis}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click a brain button to generate an AI strategic analysis for this client.
          </p>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-3 w-3 mr-1" /> Documents
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <Building2 className="h-3 w-3 mr-1" /> Relationships
          </TabsTrigger>
          <TabsTrigger value="notes">📝 Notes</TabsTrigger>
          <TabsTrigger value="reminders">⏰ Reminders</TabsTrigger>
          <TabsTrigger value="lenders">💰 Lenders</TabsTrigger>
          <TabsTrigger value="bureau">📬 Bureau Tracking</TabsTrigger>
          <TabsTrigger value="scores">📊 Score History</TabsTrigger>
          <TabsTrigger value="grants">
            <Award className="h-3 w-3 mr-1" /> Grants
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* DFS Score — computed by public.compute_funding_dfs, with full breakdown */}
          <div className="space-y-4">
            <DfsBreakdownCard
              clientId={clientId!}
              totalScore={latestDFS?.total_score}
              fundingCeiling={client.current_funding_ceiling}
              breakdown={(latestDFS as any)?.score_breakdown}
              completeness={(latestDFS as any)?.data_completeness_pct}
              computedAt={(latestDFS as any)?.computed_at}
            />
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Projected Ceiling</p>
                <p className="text-xl font-bold text-emerald-400">${Number(client.projected_funding_ceiling || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Target Amount</p>
                <p className="text-xl font-bold">${Number(client.target_funding_amount || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-xl font-bold">${Number(client.monthly_revenue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Score Simulator */}
          <ScoreSimulator clientId={clientId!} />

          {/* Infrastructure Checklist */}
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                Business Infrastructure ({completedSteps}/{checklist.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {checklist.map((item) => {
                  const guide = INFRA_GUIDES[item.step_key];
                  const isComplete = item.status === 'completed';
                  return (
                    <div key={item.id} className={`p-4 rounded-lg border transition-all ${
                      isComplete ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleStep.mutate({ id: item.id, currentStatus: item.status })}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isComplete ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground hover:border-amber-500'
                            }`}
                          >
                            {isComplete && <CheckCircle className="h-4 w-4 text-white" />}
                          </button>
                          <div>
                            <p className={`font-medium ${isComplete ? 'line-through text-muted-foreground' : ''}`}>
                              Step {item.step_order}: {item.step_label}
                            </p>
                            {guide && !isComplete && (
                              <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {guide?.url && !isComplete && (
                            <a href={guide.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3 w-3 mr-1" /> Open
                              </Button>
                            </a>
                          )}
                          {isComplete && item.completed_at && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {guide?.providers && !isComplete && (
                        <div className="mt-2 ml-9 flex gap-2 flex-wrap">
                          {guide.providers.map(p => (
                            <Badge key={p} variant="outline" className="text-xs border-amber-500/30 text-amber-400">{p}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => navigate(`/funding-machine/credit-repair?client=${clientId}`)}>
              <Shield className="h-4 w-4 mr-2" /> Credit Repair
            </Button>
            <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => navigate(`/funding-machine/business-builder?client=${clientId}`)}>
              <Building2 className="h-4 w-4 mr-2" /> Business Builder
            </Button>
            <Button variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => navigate(`/funding-machine/bureau-intel?client=${clientId}`)}>
              <CreditCard className="h-4 w-4 mr-2" /> Bureau Intel
            </Button>
            <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => navigate(`/funding-machine/funding-matrix?client=${clientId}`)}>
              <Target className="h-4 w-4 mr-2" /> Funding Matrix
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentVault clientId={clientId!} />
        </TabsContent>

        <TabsContent value="relationships">
          <LenderRelationships clientId={clientId!} />
        </TabsContent>

        <TabsContent value="notes">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Client Notes</h3>
              <button onClick={() => setShowNoteModal(true)}
                className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium hover:bg-[#B8963E]">
                + Add Note
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all','general','credit','funding','grant','call','pinned'].map(f => (
                <button key={f} onClick={() => setNotesFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    notesFilter === f
                      ? 'bg-[#C9A84C]/20 border-[#C9A84C] text-[#C9A84C]'
                      : 'border-border text-muted-foreground'
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {notesLoading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {notes
                  .filter(n => {
                    if (notesFilter === 'all') return true;
                    if (notesFilter === 'pinned') return n.is_pinned;
                    return n.note_type === notesFilter;
                  })
                  .map(note => (
                    <div key={note.id} className={`p-4 rounded-lg border relative ${
                      note.is_pinned ? 'border-[#C9A84C]/40 bg-[#C9A84C]/5' : 'border-border bg-card'
                    }`}>
                      {note.is_pinned && <span className="absolute top-2 right-8 text-[#C9A84C] text-xs">📌</span>}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                              {note.note_type}
                            </span>
                            {note.title && <span className="text-sm font-medium truncate">{note.title}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(note.created_at).toLocaleDateString()} · {note.created_by}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteNote(note.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 p-1">✕</button>
                      </div>
                    </div>
                  ))}
                {notes.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg mb-1">📝</p>
                    <p className="text-sm">No notes yet.</p>
                    <p className="text-xs mt-1">Click Add Note to get started.</p>
                  </div>
                )}
              </div>
            )}
            {showNoteModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-xl border p-6 w-full max-w-md space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">Add Note</h4>
                    <button onClick={() => setShowNoteModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  <select value={noteType} onChange={e => setNoteType(e.target.value)}
                    className="w-full p-2 rounded border bg-background text-sm">
                    {['general','credit','funding','grant','call','email','document','milestone'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                  <input type="text" placeholder="Title (optional)" value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    className="w-full p-2 rounded border bg-background text-sm" />
                  <textarea placeholder="Note content..." value={noteContent}
                    onChange={e => setNoteContent(e.target.value)} rows={4}
                    className="w-full p-2 rounded border bg-background text-sm resize-none" />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={notesPinned}
                      onChange={e => setNotesPinned(e.target.checked)} className="rounded" />
                    Pin this note
                  </label>
                  <div className="flex gap-2">
                    <button onClick={handleAddNote} disabled={!noteContent.trim()}
                      className="flex-1 py-2 bg-[#C9A84C] text-black rounded font-medium text-sm disabled:opacity-50">
                      Save Note
                    </button>
                    <button onClick={() => setShowNoteModal(false)}
                      className="flex-1 py-2 border rounded text-sm">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reminders</h3>
              <button onClick={() => setShowReminderModal(true)}
                className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium hover:bg-[#B8963E]">
                + Add Reminder
              </button>
            </div>
            {reminders.filter(r => !r.is_completed && new Date(r.due_date) < new Date()).length > 0 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                ⚠️ {reminders.filter(r => !r.is_completed && new Date(r.due_date) < new Date()).length} overdue reminder(s)
              </div>
            )}
            {remindersLoading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {reminders.map(reminder => {
                  const isOverdue = !reminder.is_completed && new Date(reminder.due_date) < new Date();
                  const isDueToday = !reminder.is_completed && reminder.due_date === new Date().toISOString().split('T')[0];
                  return (
                    <div key={reminder.id} className={`p-4 rounded-lg border flex items-start gap-3 transition ${
                      reminder.is_completed ? 'opacity-50 bg-muted/30'
                        : isOverdue ? 'border-red-500/30 bg-red-500/5'
                        : isDueToday ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border bg-card'
                    }`}>
                      <input type="checkbox" checked={reminder.is_completed}
                        onChange={() => handleCompleteReminder(reminder.id, reminder.is_completed)}
                        className="mt-1 rounded cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`font-medium text-sm ${reminder.is_completed ? 'line-through' : ''}`}>
                            {reminder.title}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            reminder.priority === 'urgent' ? 'bg-red-500/20 text-red-400'
                            : reminder.priority === 'high' ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-muted text-muted-foreground'
                          }`}>
                            {reminder.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize">
                            {reminder.reminder_type.replace('_',' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · Due {new Date(reminder.due_date + 'T00:00:00').toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteReminder(reminder.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1 text-xs">✕</button>
                    </div>
                  );
                })}
                {reminders.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg mb-1">⏰</p>
                    <p className="text-sm">No reminders yet.</p>
                  </div>
                )}
              </div>
            )}
            {showReminderModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-xl border p-6 w-full max-w-md space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">Add Reminder</h4>
                    <button onClick={() => setShowReminderModal(false)}>✕</button>
                  </div>
                  <input type="text" placeholder="Reminder title" value={reminderTitle}
                    onChange={e => setReminderTitle(e.target.value)}
                    className="w-full p-2 rounded border bg-background text-sm" />
                  <select value={reminderType} onChange={e => setReminderType(e.target.value)}
                    className="w-full p-2 rounded border bg-background text-sm">
                    {['task','follow_up','dispute_deadline','application_deadline','grant_deadline','call_scheduled','document_needed'].map(t => (
                      <option key={t} value={t}>
                        {t.replace(/_/g,' ').charAt(0).toUpperCase() + t.replace(/_/g,' ').slice(1)}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
                      <input type="date" value={reminderDue}
                        onChange={e => setReminderDue(e.target.value)}
                        className="w-full p-2 rounded border bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                      <select value={reminderPriority} onChange={e => setReminderPriority(e.target.value)}
                        className="w-full p-2 rounded border bg-background text-sm">
                        {['low','medium','high','urgent'].map(p => (
                          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddReminder}
                      disabled={!reminderTitle.trim() || !reminderDue}
                      className="flex-1 py-2 bg-[#C9A84C] text-black rounded font-medium text-sm disabled:opacity-50">
                      Save Reminder
                    </button>
                    <button onClick={() => setShowReminderModal(false)}
                      className="flex-1 py-2 border rounded text-sm">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lenders">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Matched Lenders</h3>
              <button
                onClick={handleApplyTop3}
                disabled={applyingAll || lenderMatches.filter(m => m.status === 'identified').length === 0}
                className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium hover:bg-[#B8963E] disabled:opacity-50"
              >
                {applyingAll ? '⏳ Applying...' : '⚡ Apply Top 3'}
              </button>
            </div>
            {lendersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted/40 rounded animate-pulse" />
                ))}
              </div>
            ) : lenderMatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-1">💰</p>
                <p className="text-sm">No lender matches yet.</p>
                <p className="text-xs mt-1">Click 💰 Match Lenders in the AI Brain panel above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lenderMatches.map(m => {
                  const statusColor =
                    m.status === 'applied' ? 'text-green-400 bg-green-500/10 border-green-500/30'
                    : m.status === 'approved' ? 'text-[#C9A84C] bg-[#C9A84C]/10 border-[#C9A84C]/30'
                    : m.status === 'denied' ? 'text-red-400 bg-red-500/10 border-red-500/30'
                    : 'text-muted-foreground bg-muted border-border';
                  return (
                    <div key={m.id} className="rounded-lg border p-4 flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm">{m.lender_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded border ${statusColor} capitalize`}>
                            {m.status}
                          </span>
                          {m.has_soft_pull_prequal && (
                            <span className="text-xs text-green-400">✓ Soft Pull</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {m.product_name}
                          {m.category && ` · ${m.category}`}
                          {m.max_amount && ` · Up to $${Number(m.max_amount).toLocaleString()}`}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Match:</span>
                          <div className="flex-1 max-w-32 h-1.5 bg-muted/40 rounded">
                            <div
                              className="h-full bg-[#C9A84C] rounded transition"
                              style={{ width: `${m.match_score ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{m.match_score}/100</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {m.status === 'identified' && (
                          <button
                            onClick={() => handleApplyLender(m.id)}
                            disabled={applyingLender === m.id}
                            className="px-3 py-1.5 text-xs bg-[#C9A84C] text-black rounded font-medium disabled:opacity-50"
                          >
                            {applyingLender === m.id ? '⏳' : 'Apply'}
                          </button>
                        )}
                        {m.prequal_url && (
                          <a
                            href={m.prequal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs border border-border rounded text-center text-muted-foreground hover:border-[#C9A84C]/40 no-underline"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>


        <TabsContent value="bureau" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bureau Response Tracking</h3>
            <button
              onClick={() => setShowBureauModal(true)}
              className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium hover:bg-[#B8963E]"
            >
              + Log Letter Sent
            </button>
          </div>

          {bureauLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />)}
            </div>
          ) : bureauTracking.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No letters logged yet. Click + Log Letter Sent to start tracking bureau responses.
            </div>
          ) : (
            <div className="space-y-3">
              {bureauTracking.map((row: any) => {
                const bureauColor =
                  row.bureau === 'TransUnion' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                  : row.bureau === 'Equifax'   ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30';
                const today = new Date(new Date().toISOString().split('T')[0]);
                const responded = !!row.response_received_date;

                const deadlineStatus = (dStr: string) => {
                  if (responded) return { label: '✅ Responded', cls: 'text-green-400' };
                  const d = new Date(dStr);
                  const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
                  if (days < 0) return { label: '🔴 OVERDUE', cls: 'text-red-400' };
                  if (days <= 7) return { label: `🟡 Due in ${days}d`, cls: 'text-amber-400' };
                  return { label: '⬜ Pending', cls: 'text-muted-foreground' };
                };

                const d30 = deadlineStatus(row.response_deadline_30);
                const d45 = deadlineStatus(row.response_deadline_45);
                const d60 = deadlineStatus(row.response_deadline_60);

                return (
                  <div key={row.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={`border ${bureauColor}`}>{row.bureau}</Badge>
                        <span className="text-sm">Sent {new Date(row.letter_sent_date).toLocaleDateString()}</span>
                        {row.certified_mail_number && (
                          <span className="text-xs text-muted-foreground">Cert #{row.certified_mail_number}</span>
                        )}
                      </div>
                      {responded && row.response_type && (
                        <Badge variant="outline" className="capitalize">{String(row.response_type).replace('_',' ')}</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">30-day ({new Date(row.response_deadline_30).toLocaleDateString()})</p>
                        <p className={d30.cls}>{d30.label}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">45-day ({new Date(row.response_deadline_45).toLocaleDateString()})</p>
                        <p className={d45.cls}>{d45.label}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">60-day ({new Date(row.response_deadline_60).toLocaleDateString()})</p>
                        <p className={d60.cls}>{d60.label}</p>
                      </div>
                    </div>

                    {!responded && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Mark response:</span>
                        <select
                          onChange={(e) => { const v = e.target.value; if (v) { handleMarkResponse(row.id, v); e.target.value = ''; } }}
                          className="text-xs bg-background border rounded px-2 py-1"
                          defaultValue=""
                        >
                          <option value="" disabled>Select…</option>
                          <option value="deleted">Deleted</option>
                          <option value="verified">Verified</option>
                          <option value="updated">Updated</option>
                          <option value="no_response">No Response</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showBureauModal && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowBureauModal(false)}>
              <div className="w-full max-w-md rounded-xl bg-card border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">Log Letter Sent</h3>
                <div>
                  <label className="text-xs text-muted-foreground">Bureau</label>
                  <select value={newBureau} onChange={(e) => setNewBureau(e.target.value)}
                    className="w-full mt-1 bg-background border rounded px-3 py-2 text-sm">
                    <option value="TransUnion">TransUnion</option>
                    <option value="Equifax">Equifax</option>
                    <option value="Experian">Experian</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Letter sent date</label>
                  <input type="date" value={newLetterDate} onChange={(e) => setNewLetterDate(e.target.value)}
                    className="w-full mt-1 bg-background border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Certified mail # (optional)</label>
                  <input type="text" value={newCertifiedMail} onChange={(e) => setNewCertifiedMail(e.target.value)}
                    placeholder="7014 XXXX XXXX XXXX XXXX"
                    className="w-full mt-1 bg-background border rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => setShowBureauModal(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
                  <button onClick={handleLogLetter} className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium">Save</button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scores">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Credit Score History</h3>
              <button onClick={() => setShowScoreModal(true)}
                className="px-3 py-1.5 bg-[#C9A84C] text-black rounded text-sm font-medium hover:bg-[#B8963E]">
                + Add Score Update
              </button>
            </div>
            {scoreLoading ? (
              <div className="h-64 bg-muted rounded animate-pulse" />
            ) : scoreHistory.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreHistory}>
                    <XAxis dataKey="score_date" tick={{ fontSize: 11 }}
                      tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                    <YAxis domain={[300, 850]} tick={{ fontSize: 11 }} />
                    <RTooltip formatter={(v: any, name: string) => [v, name.toUpperCase()]} />
                    <Legend />
                    <Line type="monotone" dataKey="score_tu" name="TU" stroke="#3B82F6" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
                    <Line type="monotone" dataKey="score_eq" name="EQ" stroke="#22C55E" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
                    <Line type="monotone" dataKey="score_ex" name="EX" stroke="#EF4444" dot={{ r: 3 }} strokeWidth={2} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
                No score history yet. Add a score update to start tracking progress.
              </div>
            )}
            {scoreHistory.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="pb-2 text-left">Date</th>
                      <th className="pb-2 text-center">TransUnion</th>
                      <th className="pb-2 text-center">Equifax</th>
                      <th className="pb-2 text-center">Experian</th>
                      <th className="pb-2 text-center">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...scoreHistory].reverse().map(row => {
                      const scores = [row.score_tu, row.score_eq, row.score_ex].filter(Boolean) as number[];
                      const avg = scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : null;
                      return (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-2">{new Date(row.score_date + 'T00:00:00').toLocaleDateString()}</td>
                          <td className="py-2 text-center text-blue-400">{row.score_tu ?? '—'}</td>
                          <td className="py-2 text-center text-green-400">{row.score_eq ?? '—'}</td>
                          <td className="py-2 text-center text-red-400">{row.score_ex ?? '—'}</td>
                          <td className="py-2 text-center font-medium">{avg ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {showScoreModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-card rounded-xl border p-6 w-full max-w-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-lg">Add Score Update</h4>
                    <button onClick={() => setShowScoreModal(false)}>✕</button>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                    <input type="date" value={scoreDate}
                      onChange={e => setScoreDate(e.target.value)}
                      className="w-full p-2 rounded border bg-background text-sm" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-blue-400 mb-1 block">TransUnion</label>
                      <input type="number" min="300" max="850" placeholder="TU" value={scoreTU}
                        onChange={e => setScoreTU(e.target.value)}
                        className="w-full p-2 rounded border bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-green-400 mb-1 block">Equifax</label>
                      <input type="number" min="300" max="850" placeholder="EQ" value={scoreEQ}
                        onChange={e => setScoreEQ(e.target.value)}
                        className="w-full p-2 rounded border bg-background text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-red-400 mb-1 block">Experian</label>
                      <input type="number" min="300" max="850" placeholder="EX" value={scoreEX}
                        onChange={e => setScoreEX(e.target.value)}
                        className="w-full p-2 rounded border bg-background text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddScore}
                      disabled={!scoreTU && !scoreEQ && !scoreEX}
                      className="flex-1 py-2 bg-[#C9A84C] text-black rounded font-medium text-sm disabled:opacity-50">
                      Save Scores
                    </button>
                    <button onClick={() => setShowScoreModal(false)}
                      className="flex-1 py-2 border rounded text-sm">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>



        <TabsContent value="grants" className="space-y-6">
          {/* A — Eligibility Banner */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  {eligibility?.grant_eligible ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-emerald-300 font-medium">✅ This client qualifies for grants</div>
                      {eligibility.grant_checked_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last checked: {timeAgo(eligibility.grant_checked_at)}
                        </div>
                      )}
                    </div>
                  ) : eligibility?.grant_checked_at ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="text-amber-300 font-medium">No grants matched yet.</div>
                      <div className="text-xs text-muted-foreground mt-1">Re-check as credit improves.</div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="text-muted-foreground">Grant eligibility not yet checked.</div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleCheckEligibility}
                  disabled={checkingEligibility}
                  style={{ backgroundColor: GOLD, color: '#000' }}
                  className="hover:opacity-90"
                >
                  {checkingEligibility ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 🔍 Checking...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> 🔍 Check Grant Eligibility</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* B — Matched Grants */}
          <Card>
            <CardHeader><CardTitle>Matched Grants</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {grantMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {eligibility?.grant_checked_at
                    ? 'No grants matched current profile. Re-check as credit score improves.'
                    : 'Click Check Eligibility above to find grants for this client.'}
                </p>
              ) : (
                <div className="grid gap-3">
                  {grantMatches.map((m: any) => (
                    <div key={m.id} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">🏆 {m.grant_name}</div>
                          <div className="text-sm text-muted-foreground">{m.funder_name}</div>
                        </div>
                        {m.grant_amount != null && (
                          <div className="text-lg font-bold" style={{ color: GOLD }}>
                            ${Number(m.grant_amount).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="w-full bg-muted rounded h-2">
                          <div
                            className="h-2 rounded"
                            style={{ width: `${m.eligibility_score ?? 0}%`, backgroundColor: GOLD }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {m.eligibility_score ?? 0}% match
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Deadline: {m.deadline ? new Date(m.deadline).toLocaleDateString() : 'Rolling'}
                      </div>
                      {m.eligibility_notes && (
                        <div className="text-xs text-muted-foreground italic">{m.eligibility_notes}</div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleStartApplication(m)}
                          style={{ backgroundColor: GOLD, color: '#000' }}
                        >
                          Start Application
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSkipMatch(m.id)}>
                          Skip
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* C — Active Applications */}
          <Card>
            <CardHeader><CardTitle>Active Applications</CardTitle></CardHeader>
            <CardContent>
              {activeApps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No active applications. Start one from matched grants above.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Grant</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Requested</th>
                        <th className="py-2 pr-3">Deadline</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeApps.map((a: any) => (
                        <tr key={a.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{a.grant_name}</div>
                            <div className="text-xs text-muted-foreground">{a.funder_name}</div>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline" className="capitalize">{a.status}</Badge>
                          </td>
                          <td className="py-2 pr-3">
                            {a.amount_requested != null ? `$${Number(a.amount_requested).toLocaleString()}` : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {a.deadline ? new Date(a.deadline).toLocaleDateString() : 'Rolling'}
                          </td>
                          <td className="py-2">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/os/grants/${a.id}`)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* D — Won Grants */}
          <Card>
            <CardHeader><CardTitle>Won Grants</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {wonApps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No grants awarded yet. Keep applying.
                </p>
              ) : (
                <>
                  <div
                    className="p-4 rounded-lg border"
                    style={{ backgroundColor: `${GOLD}15`, borderColor: `${GOLD}55` }}
                  >
                    <div className="text-sm text-muted-foreground">Total awarded</div>
                    <div className="text-2xl font-bold" style={{ color: GOLD }}>
                      🏆 ${wonApps.reduce((s: number, a: any) => s + Number(a.amount_awarded || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {wonApps.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div>
                          <div className="font-medium">{a.grant_name}</div>
                          <div className="text-xs text-muted-foreground">{a.funder_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: GOLD }}>
                            ${Number(a.amount_awarded || 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.award_date ? new Date(a.award_date).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AutoFillApplicationDialog
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        clientId={clientId}
        funderType="lender"
      />
    </div>
  );
}
