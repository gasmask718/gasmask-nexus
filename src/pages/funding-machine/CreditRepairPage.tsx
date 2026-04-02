import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, Plus, Brain, ArrowLeft, Clock, AlertTriangle,
  Mail, FileText, Send, RefreshCw, ChevronUp, Upload
} from "lucide-react";
import CreditReportUploadModal from "@/components/funding-machine/CreditReportUploadModal";

const LETTER_TYPES = [
  { value: 'fcra_609', label: 'FCRA §609 Dispute' },
  { value: 'fcra_611', label: 'FCRA §611 Reinvestigation' },
  { value: 'fcra_623', label: 'FCRA §623 Furnisher Dispute' },
  { value: 'fdcpa_809', label: 'FDCPA §809 Debt Validation' },
  { value: 'goodwill', label: 'Goodwill Adjustment' },
  { value: 'mov', label: 'Method of Verification' },
  { value: 'pay_for_delete', label: 'Pay for Delete' },
  { value: 'identity_theft', label: 'Identity Theft Affidavit' },
];

const ITEM_TYPES = [
  'Late Payment', 'Collection', 'Charge-Off', 'Bankruptcy', 'Judgment',
  'Repossession', 'Hard Inquiry', 'Mixed File', 'Identity Error'
];

export default function CreditRepairPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientId = searchParams.get('client');
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedLetterType, setSelectedLetterType] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({
    bureau: 'TransUnion', creditor_name: '', item_type: 'Late Payment',
    account_number: '', balance: '', date_of_first_delinquency: '',
    current_status: 'open', notes: ''
  });

  // Client selector
  const { data: clients = [] } = useQuery({
    queryKey: ['funding-clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select('id, first_name, last_name, business_name').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: client } = useQuery({
    queryKey: ['funding-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select('*').eq('id', clientId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: creditItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['funding-credit-items', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_credit_items').select('*').eq('client_id', clientId!).order('deletion_priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: disputeRounds = [] } = useQuery({
    queryKey: ['funding-dispute-rounds', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_dispute_rounds').select('*, funding_credit_items(creditor_name, bureau)').eq('client_id', clientId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mailingLog = [] } = useQuery({
    queryKey: ['funding-mailing-log', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_mailing_log').select('*').eq('client_id', clientId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('funding_credit_items').insert({
        client_id: clientId!,
        bureau: newItem.bureau,
        creditor_name: newItem.creditor_name,
        item_type: newItem.item_type,
        account_number: newItem.account_number || null,
        balance: newItem.balance ? parseFloat(newItem.balance) : null,
        date_of_first_delinquency: newItem.date_of_first_delinquency || null,
        current_status: newItem.current_status,
        notes: newItem.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-credit-items', clientId] });
      toast.success('Credit item added');
      setShowAddItem(false);
      setNewItem({ bureau: 'TransUnion', creditor_name: '', item_type: 'Late Payment', account_number: '', balance: '', date_of_first_delinquency: '', current_status: 'open', notes: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const analyzeItems = async () => {
    if (creditItems.length === 0) { toast.error('No credit items to analyze'); return; }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'analyze_credit_items',
          items: creditItems,
          client: client ? { first_name: client.first_name, last_name: client.last_name } : null,
        },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysisResults(data.analysis);
        toast.success('Analysis complete — items prioritized');
      }
    } catch (err: any) {
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateLetter = async () => {
    if (!selectedItem || !selectedLetterType) { toast.error('Select an item and letter type'); return; }
    setIsGeneratingLetter(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_letter',
          item: selectedItem,
          letter_type: selectedLetterType,
          client: client,
        },
      });
      if (error) throw error;
      if (data?.letter) setGeneratedLetter(data.letter);
    } catch (err: any) {
      toast.error(`Letter generation failed: ${err.message}`);
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const sendLetter = async () => {
    if (!selectedItem || !generatedLetter) return;
    try {
      // Get max round number for this item
      const existingRounds = disputeRounds.filter(r => r.credit_item_id === selectedItem.id);
      const nextRound = existingRounds.length > 0 ? Math.max(...existingRounds.map(r => r.round_number)) + 1 : 1;
      const responseDeadline = new Date();
      responseDeadline.setDate(responseDeadline.getDate() + 30);

      const { data: round, error: roundErr } = await supabase.from('funding_dispute_rounds').insert({
        client_id: clientId!,
        credit_item_id: selectedItem.id,
        bureau: selectedItem.bureau,
        letter_type: selectedLetterType,
        letter_content: generatedLetter,
        round_number: nextRound,
        status: 'sent',
        sent_date: new Date().toISOString(),
        response_deadline: responseDeadline.toISOString(),
      }).select().single();
      if (roundErr) throw roundErr;

      const { data: mailLog } = await supabase.from('funding_mailing_log').insert({
        client_id: clientId!,
        dispute_round_id: round.id,
        recipient_name: selectedItem.creditor_name,
        mail_type: 'certified',
        delivery_status: 'pending_dispatch',
        sent_date: new Date().toISOString(),
      }).select().single();

      // Attempt PostGrid dispatch
      if (mailLog && client) {
        const { data: pgResult } = await supabase.functions.invoke('funding-postgrid', {
          body: {
            letter_content: generatedLetter,
            client_name: `${client.first_name} ${client.last_name}`,
            client_address: client.address || '',
            client_city: client.city || '',
            client_state: client.state || '',
            client_zip: client.zip_code || '',
            bureau: selectedItem.bureau,
            mailing_log_id: mailLog.id,
          },
        });
        if (pgResult?.code === 'NO_API_KEY') {
          toast.warning('Certified mail queued — add PostGrid API key in Settings to enable dispatch. Letter saved to mail log.');
        } else if (pgResult?.success) {
          toast.success(`Letter dispatched via PostGrid — ID: ${pgResult.letter_id}`);
        } else if (pgResult?.error) {
          toast.warning(`Mail logged but PostGrid dispatch failed: ${pgResult.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['funding-dispute-rounds', clientId] });
      queryClient.invalidateQueries({ queryKey: ['funding-mailing-log', clientId] });
      setGeneratedLetter('');
      setSelectedItem(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getAnalysisForItem = (itemId: string) => analysisResults.find(a => a.item_id === itemId);

  // Group items by bureau
  const bureaus = ['TransUnion', 'Equifax', 'Experian'] as const;
  const itemsByBureau = bureaus.reduce((acc, b) => {
    acc[b] = creditItems.filter(i => i.bureau === b);
    return acc;
  }, {} as Record<string, typeof creditItems>);

  if (!clientId) {
    return (
      <div className="min-h-screen p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">Credit Repair Command Center</h1>
        </div>
        <Card className="border-red-500/20 max-w-lg mx-auto">
          <CardHeader><CardTitle>Select a Client</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clients.map(c => (
              <Button key={c.id} variant="outline" className="w-full justify-start border-border/50 hover:border-red-500/40"
                onClick={() => navigate(`/funding-machine/credit-repair?client=${c.id}`)}>
                {c.first_name} {c.last_name} {c.business_name && `— ${c.business_name}`}
              </Button>
            ))}
            {clients.length === 0 && <p className="text-muted-foreground text-center py-4">No clients. Onboard a client first.</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">Credit Repair Command Center</h1>
            {client && <p className="text-muted-foreground">{client.first_name} {client.last_name}</p>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="items">Items ({creditItems.length})</TabsTrigger>
          <TabsTrigger value="disputes">Disputes ({disputeRounds.length})</TabsTrigger>
          <TabsTrigger value="letters">Letters</TabsTrigger>
          <TabsTrigger value="mail">Mail Log ({mailingLog.length})</TabsTrigger>
        </TabsList>

        {/* ═══ ITEMS TAB ═══ */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => setShowAddItem(!showAddItem)} variant="outline" className="border-red-500/30 text-red-400">
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
            <Button onClick={analyzeItems} disabled={isAnalyzing || creditItems.length === 0}
              className="bg-gradient-to-r from-red-600 to-rose-500 text-white">
              {isAnalyzing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Brain className="h-4 w-4 mr-1" />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze & Prioritize'}
            </Button>
          </div>

          {showAddItem && (
            <Card className="border-red-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Bureau *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newItem.bureau} onChange={e => setNewItem(p => ({ ...p, bureau: e.target.value }))}>
                      <option>TransUnion</option><option>Equifax</option><option>Experian</option>
                    </select>
                  </div>
                  <div>
                    <Label>Creditor Name *</Label>
                    <Input value={newItem.creditor_name} onChange={e => setNewItem(p => ({ ...p, creditor_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Item Type *</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newItem.item_type} onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value }))}>
                      {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Account #</Label>
                    <Input value={newItem.account_number} onChange={e => setNewItem(p => ({ ...p, account_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Balance ($)</Label>
                    <Input type="number" value={newItem.balance} onChange={e => setNewItem(p => ({ ...p, balance: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Date of First Delinquency</Label>
                    <Input type="date" value={newItem.date_of_first_delinquency} onChange={e => setNewItem(p => ({ ...p, date_of_first_delinquency: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newItem.current_status} onChange={e => setNewItem(p => ({ ...p, current_status: e.target.value }))}>
                      <option value="open">Open</option><option value="closed">Closed</option><option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
                <div className="flex gap-2">
                  <Button onClick={() => addItemMutation.mutate()} disabled={!newItem.creditor_name || addItemMutation.isPending}
                    className="bg-gradient-to-r from-red-600 to-rose-500 text-white">
                    {addItemMutation.isPending ? 'Saving...' : 'Save Item'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {itemsLoading ? (
            <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-red-500" /></div>
          ) : creditItems.length === 0 ? (
            <Card className="border-border/30"><CardContent className="py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No credit items added yet. Click "Add Item" to begin.</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bureaus.map(bureau => (
                <div key={bureau} className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${bureau === 'TransUnion' ? 'bg-blue-500' : bureau === 'Equifax' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    {bureau} ({itemsByBureau[bureau]?.length || 0})
                  </h3>
                  {(itemsByBureau[bureau] || []).map((item, idx) => {
                    const analysis = getAnalysisForItem(item.id);
                    const prob = analysis?.deletion_probability || (item.estimated_score_impact && item.estimated_score_impact > 7 ? 'high' : item.estimated_score_impact && item.estimated_score_impact > 4 ? 'medium' : 'low');
                    return (
                      <Card key={item.id} className="border-border/30 hover:border-red-500/30 transition-all cursor-pointer"
                        onClick={() => { setSelectedItem(item); }}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.creditor_name}</span>
                            {analysis && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                #{analysis.priority}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{item.item_type}</Badge>
                            {item.balance && <span className="text-xs text-muted-foreground">${Number(item.balance).toLocaleString()}</span>}
                          </div>
                          {item.date_of_first_delinquency && (
                            <p className="text-xs text-muted-foreground">DoFD: {new Date(item.date_of_first_delinquency).toLocaleDateString()}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Impact: {item.estimated_score_impact || '—'}/10</span>
                            <Badge className={`text-xs ${
                              prob === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              prob === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {prob} del.
                            </Badge>
                          </div>
                          {analysis && (
                            <div className="mt-2 p-2 rounded bg-muted/30 text-xs">
                              <p className="font-medium text-amber-400">Recommended: {analysis.letter_type}</p>
                              <p className="text-muted-foreground mt-1">{analysis.reasoning}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ DISPUTES TAB ═══ */}
        <TabsContent value="disputes" className="space-y-3">
          {disputeRounds.length === 0 ? (
            <Card className="border-border/30"><CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No dispute rounds yet. Generate a letter first.</p>
            </CardContent></Card>
          ) : disputeRounds.map(round => {
            const days = getDaysRemaining(round.response_deadline);
            const isExpired = days !== null && days <= 0 && !round.response_received;
            const isWarning = days !== null && days > 0 && days <= 7 && !round.response_received;
            return (
              <Card key={round.id} className={`border-border/30 ${isExpired ? 'border-red-500/40 bg-red-500/5' : isWarning ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{(round as any).funding_credit_items?.creditor_name || 'Unknown'} — Round {round.round_number}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{round.letter_type}</Badge>
                        <Badge variant="outline" className="text-xs">{round.bureau}</Badge>
                        <Badge className={`text-xs ${round.status === 'sent' ? 'bg-blue-500/20 text-blue-400' : round.status === 'responded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {round.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      {days !== null && !round.response_received && (
                        <div className={`flex items-center gap-1 ${isExpired ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-muted-foreground'}`}>
                          {isExpired ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          <span className="text-sm font-medium">{isExpired ? `${Math.abs(days!)}d overdue` : `${days}d remaining`}</span>
                        </div>
                      )}
                      {round.response_received && (
                        <Badge className="bg-emerald-500/20 text-emerald-400">Response received</Badge>
                      )}
                    </div>
                  </div>
                  {isExpired && (
                    <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700 text-white" onClick={() => {
                      setSelectedItem(creditItems.find(i => i.id === round.credit_item_id));
                      setSelectedLetterType('fcra_611');
                    }}>
                      <ChevronUp className="h-3 w-3 mr-1" /> Auto-Escalate
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══ LETTERS TAB ═══ */}
        <TabsContent value="letters" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-red-500/20">
              <CardHeader><CardTitle className="text-lg">Generate Dispute Letter</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Credit Item</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedItem?.id || ''} onChange={e => setSelectedItem(creditItems.find(i => i.id === e.target.value) || null)}>
                    <option value="">Choose item...</option>
                    {creditItems.map(i => (
                      <option key={i.id} value={i.id}>{i.creditor_name} ({i.bureau}) — {i.item_type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Letter Type</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedLetterType} onChange={e => setSelectedLetterType(e.target.value)}>
                    <option value="">Choose type...</option>
                    {LETTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <Button onClick={generateLetter} disabled={isGeneratingLetter || !selectedItem || !selectedLetterType}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-500 text-white">
                  {isGeneratingLetter ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Generating...</> : <><FileText className="h-4 w-4 mr-1" /> Generate Letter</>}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Letter Preview
                  {generatedLetter && (
                    <Button size="sm" onClick={sendLetter} className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black">
                      <Send className="h-3 w-3 mr-1" /> Send Certified Mail
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedLetter ? (
                  <pre className="whitespace-pre-wrap text-sm bg-muted/20 p-4 rounded-lg border border-border/30 max-h-[500px] overflow-y-auto font-mono">
                    {generatedLetter}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select an item and letter type, then click Generate.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ MAIL LOG TAB ═══ */}
        <TabsContent value="mail" className="space-y-3">
          {mailingLog.length === 0 ? (
            <Card className="border-border/30"><CardContent className="py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No mail dispatched yet.</p>
            </CardContent></Card>
          ) : (
            <Card className="border-border/30">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Recipient</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Sent</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tracking</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailingLog.map(m => (
                      <tr key={m.id} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="p-3 font-medium text-sm">{m.recipient_name || '—'}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{m.mail_type || 'certified'}</Badge></td>
                        <td className="p-3 text-sm text-muted-foreground">{m.sent_date ? new Date(m.sent_date).toLocaleDateString() : '—'}</td>
                        <td className="p-3 text-sm font-mono text-xs">
                          {m.tracking_number ? (
                            <a href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${m.tracking_number}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 underline hover:text-amber-300">{m.tracking_number}</a>
                          ) : 'Pending'}
                        </td>
                        <td className="p-3">
                          <Badge className={`text-xs ${
                            m.delivery_status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                            m.delivery_status === 'in_transit' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>{m.delivery_status || 'pending'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
