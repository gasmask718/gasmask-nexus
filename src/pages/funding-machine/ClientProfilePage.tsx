import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  User, Building2, Target, Shield, CreditCard, TrendingUp,
  CheckCircle, Clock, AlertTriangle, ArrowLeft, RefreshCw,
  ExternalLink, FileText, Send, Award, Search, Loader2
} from "lucide-react";
import DocumentVault from "@/components/funding-machine/DocumentVault";
import ScoreSimulator from "@/components/funding-machine/ScoreSimulator";
import LenderRelationships from "@/components/funding-machine/LenderRelationships";

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
      const { data, error } = await supabase.from('funding_clients').select('*').eq('id', clientId).single();
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
  const [scoreLoading, setScoreLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreTU, setScoreTU] = useState('');
  const [scoreEQ, setScoreEQ] = useState('');
  const [scoreEX, setScoreEX] = useState('');
  const [scoreDate, setScoreDate] = useState(new Date().toISOString().split('T')[0]);

  const [clientStage, setClientStage] = useState('intake');

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

  useEffect(() => {
    if (!clientId) return;
    loadNotesAndReminders();
    loadScoreHistory();
    loadClientStage();
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
          <Button variant="outline" size="sm" onClick={sendPortalInvite} className="border-amber-500/30 text-amber-400">
            <Send className="h-3 w-3 mr-1" /> Send Portal Invite
          </Button>
          <Badge variant="outline" className={
            client.status === 'active' ? 'border-emerald-500/30 text-emerald-500 text-lg px-4 py-1' :
            'border-amber-500/30 text-amber-500 text-lg px-4 py-1'
          }>
            {client.status}
          </Badge>
        </div>
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
          <TabsTrigger value="grants">
            <Award className="h-3 w-3 mr-1" /> Grants
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* DFS Score */}
          <Card className="border-amber-500/20 bg-gradient-to-br from-background to-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Dynasty Fundability Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8 mb-6">
                <div className="text-center">
                  <div className="text-6xl font-bold text-amber-400">{latestDFS?.total_score || 0}</div>
                  <div className="text-sm text-muted-foreground">of 100</div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Current Ceiling</p>
                    <p className="text-xl font-bold text-amber-400">${Number(client.current_funding_ceiling || 0).toLocaleString()}</p>
                  </div>
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

              {/* Dimension Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {DFS_DIMENSIONS.map(dim => {
                  const value = latestDFS ? (latestDFS as any)[dim.key] || 0 : 0;
                  const pct = (value / dim.max) * 100;
                  return (
                    <div key={dim.key} className="p-3 rounded-lg bg-muted/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{dim.label}</span>
                        <span className="text-xs font-bold">{value}/{dim.max}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

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
    </div>
  );
}
