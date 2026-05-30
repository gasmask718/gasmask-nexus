import { useState } from 'react';
import { format } from 'date-fns';
import {
  Shield, Search, FileText, AlertTriangle, FileWarning, Loader2,
  CheckCircle, XCircle, Eye, Send, GitCompare,
  TrendingUp, DollarSign, AlertCircle, ClipboardList, Lock,
  ShieldCheck, ShieldAlert, ToggleLeft, ToggleRight, Archive, LockKeyhole,
  UserPlus, Phone, Mail, MapPin, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  useParseNotes,
  useAuditBatches,
  useAuditEvents,
  useAuditFlags,
  useAuditDrafts,
  useAuditMetrics,
  useProcessDraft,
  useResolveFlag,
  useFinalizeIntent,
  useFinalizeDraft,
  useRunReconciliation,
  useReconciliationResults,
  useApplyReconciliation,
  useStrictVerification,
  useVerificationSnapshots,
  useUpdateBatchStatus,
  useRunEnrichment,
  useEnrichmentCandidates,
  useProcessEnrichment,
  type AuditInvoiceDraft,
  type AuditFlag,
  type AuditBatch,
  type AuditReconciliationResult,
  type AuditVerificationSnapshot,
  type EnrichmentCandidate,
} from '@/hooks/useAuditEngine';

// ═══ Color Maps ═══
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600/20 text-red-400 border-red-600/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  MISSING_INVOICE: '🧾 Missing Invoice',
  MISSING_NOTE: '📝 Missing Note',
  POSSIBLE_DUPLICATE: '🔁 Possible Duplicate',
  PAYMENT_UNMATCHED: '💰 Payment Unmatched',
  QUANTITY_UNPRICED: '📦 Quantity Unpriced',
  STORE_NOT_LINKED: '🔗 Store Not Linked',
  FOLLOW_UP_REQUIRED: '📞 Follow-Up Required',
  DATE_AMBIGUOUS: '📅 Date Ambiguous',
  CONFLICTING_AMOUNTS: '⚠️ Conflicting Amounts',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  delivery: 'bg-green-500/15 text-green-400',
  payment: 'bg-emerald-500/15 text-emerald-400',
  visit: 'bg-blue-500/15 text-blue-400',
  order_request: 'bg-purple-500/15 text-purple-400',
  unpaid_balance: 'bg-red-500/15 text-red-400',
  inventory_check: 'bg-yellow-500/15 text-yellow-400',
  note_only: 'bg-cyan-500/15 text-cyan-400',
  unknown: 'bg-muted text-muted-foreground',
};

export default function AuditEnginePage() {
  const [rawText, setRawText] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('ingest');
  const [draftDialog, setDraftDialog] = useState<AuditInvoiceDraft | null>(null);
  const [flagDialog, setFlagDialog] = useState<AuditFlag | null>(null);
  const [finalizeDialog, setFinalizeDialog] = useState<AuditInvoiceDraft | null>(null);
  const [confirmFinalizeDialog, setConfirmFinalizeDialog] = useState<AuditInvoiceDraft | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [ignoreReasonDialog, setIgnoreReasonDialog] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');

  const parseNotes = useParseNotes();
  const { data: batches } = useAuditBatches();
  const { data: events } = useAuditEvents(selectedBatchId);
  const { data: flags } = useAuditFlags(selectedBatchId);
  const { data: drafts } = useAuditDrafts(selectedBatchId);
  const { data: metrics } = useAuditMetrics();
  const processDraft = useProcessDraft();
  const resolveFlag = useResolveFlag();
  const finalizeIntent = useFinalizeIntent();
  const finalizeDraft = useFinalizeDraft();
  const runReconciliation = useRunReconciliation();
  const { data: reconResults } = useReconciliationResults(selectedBatchId);
  const applyRecon = useApplyReconciliation();
  const strictVerify = useStrictVerification();
  const { data: snapshots } = useVerificationSnapshots(selectedBatchId);
  const updateBatchStatus = useUpdateBatchStatus();
  const runEnrichment = useRunEnrichment();
  const { data: enrichmentCandidates } = useEnrichmentCandidates(selectedBatchId);
  const processEnrichment = useProcessEnrichment();

  // Determine if selected batch is locked
  const selectedBatch = batches?.find(b => b.id === selectedBatchId);
  const isBatchClosed = selectedBatch?.batch_status === 'closed';
  const batchStatus = selectedBatch?.batch_status || 'open';
  // Filter recon results based on mode
  const filteredReconResults = strictMode
    ? (reconResults || []).filter(r => r.confidence_score >= 80)
    : reconResults;

  const handleParse = async () => {
    if (!rawText.trim()) return;
    const result = await parseNotes.mutateAsync(rawText);
    setSelectedBatchId(result.batch_id);
    setActiveTab('events');
    setRawText('');
  };

  const handleDraftAction = async (action: 'approve' | 'reject') => {
    if (!draftDialog) return;
    await processDraft.mutateAsync({ draftId: draftDialog.id, action, notes: actionNotes });
    setDraftDialog(null);
    setActionNotes('');
  };

  const handleResolveFlag = async (action: 'resolve' | 'dismiss' = 'resolve') => {
    if (!flagDialog) return;
    await resolveFlag.mutateAsync({ flagId: flagDialog.id, action, notes: actionNotes });
    setFlagDialog(null);
    setActionNotes('');
  };

  const handleFinalizeIntent = async () => {
    if (!finalizeDialog) return;
    await finalizeIntent.mutateAsync({ draftId: finalizeDialog.id, notes: actionNotes });
    setFinalizeDialog(null);
    setActionNotes('');
  };

  const handleCreateLiveInvoice = async () => {
    if (!confirmFinalizeDialog) return;
    await finalizeDraft.mutateAsync(confirmFinalizeDialog.id);
    setConfirmFinalizeDialog(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold">Intelligent Audit Engine</h1>
          <p className="text-muted-foreground text-sm">
            Forensic reconstruction • Invoice drafting • Revenue recovery
          </p>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricCard icon={ClipboardList} label="Events Parsed" value={metrics?.totalEvents || 0} />
        <MetricCard icon={AlertTriangle} label="Open Flags" value={metrics?.openFlags || 0} color="text-orange-400" />
        <MetricCard icon={FileText} label="Pending Drafts" value={metrics?.pendingDrafts || 0} color="text-yellow-400" />
        <MetricCard icon={CheckCircle} label="Approved" value={metrics?.approvedDrafts || 0} color="text-green-400" />
        <MetricCard icon={Lock} label="Ready to Finalize" value={metrics?.readyToFinalize || 0} color="text-blue-400" />
        <MetricCard icon={DollarSign} label="Est. Recovery" value={`$${(metrics?.estimatedRecovery || 0).toLocaleString()}`} color="text-emerald-400" />
        <MetricCard icon={FileWarning} label="Missing Invoices" value={metrics?.missingInvoices || 0} color="text-red-400" />
        <MetricCard icon={GitCompare} label="Open Recon" value={metrics?.openRecon || 0} color="text-purple-400" />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="ingest">📥 Ingest</TabsTrigger>
          <TabsTrigger value="events">📋 Events</TabsTrigger>
          <TabsTrigger value="flags">🔎 Flags</TabsTrigger>
          <TabsTrigger value="drafts">🧾 Drafts</TabsTrigger>
          <TabsTrigger value="recon">🔍 Reconciliation</TabsTrigger>
          <TabsTrigger value="enrichment">👥 Enrichment</TabsTrigger>
          <TabsTrigger value="history">📂 History</TabsTrigger>
        </TabsList>

        {/* Batch Lockdown Banner */}
        {isBatchClosed && activeTab !== 'ingest' && activeTab !== 'history' && (
          <div className="bg-muted/50 border border-muted rounded-lg p-4 flex items-center gap-3">
            <LockKeyhole className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Batch Closed — View Only</p>
              <p className="text-xs text-muted-foreground">
                This batch was closed on {selectedBatch?.closed_at ? format(new Date(selectedBatch.closed_at), 'MMM d, yyyy h:mm a') : 'unknown'}.
                No further modifications are permitted.
              </p>
            </div>
          </div>
        )}
        <TabsContent value="ingest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" /> Paste Raw Notes
              </CardTitle>
              <CardDescription>
                Paste unstructured notes, CRM entries, WhatsApp exports, or route logs.
                AI will parse, organize by store, detect gaps, and generate invoice drafts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder={`Example:\nSmoke Palace on Fulton - delivered 2 boxes GasMask tubes, 1 box Hot Mama\nOwes $450 from last week, paid $200 cash today\nBring order next Tuesday\n\nCorner Deli 5th Ave - dropped samples, needs stickers\nNo invoice on file for January delivery...`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {rawText.length} characters • AI will parse into structured events
                </p>
                <Button onClick={handleParse} disabled={!rawText.trim() || parseNotes.isPending} className="gap-2">
                  {parseNotes.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Parsing...</>
                  ) : (
                    <><Search className="h-4 w-4" /> Parse & Analyze</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3">
                ⚠️ This system is an intelligence layer. It does NOT auto-modify invoices, revenue, commissions, or inventory.
                Everything requires manual approval.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ EVENTS TAB ═══ */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Parsed Events {events?.length ? `(${events.length})` : ''}</CardTitle>
              <CardDescription>Atomic events extracted from notes, organized by store and date</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Store Match</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Brand / Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Unpaid</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!events?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {selectedBatchId ? 'No events found' : 'Parse notes to see events'}
                      </TableCell>
                    </TableRow>
                  ) : events.map(evt => (
                    <TableRow key={evt.id}>
                      <TableCell className="text-sm">
                        {evt.event_date ? format(new Date(evt.event_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          {evt.store_match_method && evt.store_match_method !== 'unlinked' ? (
                            <Badge variant="outline" className="text-[10px]">{evt.store_match_method}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">unlinked</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={EVENT_TYPE_COLORS[evt.event_type] || EVENT_TYPE_COLORS.unknown}>
                          {evt.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {evt.brand || evt.product || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{evt.quantity_raw || evt.quantity_numeric || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {evt.amount_paid ? `$${evt.amount_paid}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {evt.amount_unpaid ? (
                          <span className="text-red-400">${evt.amount_unpaid}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <ConfidenceBadge score={evt.confidence_score} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ FLAGS TAB ═══ */}
        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Flagged Issues {flags?.length ? `(${flags.length})` : ''}
              </CardTitle>
              <CardDescription>Data gaps, missing invoices, and inconsistencies detected by AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!flags?.length ? (
                <p className="text-center py-8 text-muted-foreground">
                  {selectedBatchId ? 'No flags detected — data looks clean' : 'Parse notes to detect issues'}
                </p>
              ) : flags.map(flag => (
                <div
                  key={flag.id}
                  className={`border rounded-lg p-4 space-y-2 ${
                    flag.status === 'resolved' || flag.status === 'dismissed' ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={SEVERITY_COLORS[flag.severity] || ''}>
                        {flag.severity}
                      </Badge>
                      <span className="text-sm font-medium">
                        {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                      </span>
                      <span className="text-xs text-muted-foreground">{flag.title}</span>
                    </div>
                    {flag.status === 'open' && !isBatchClosed ? (
                      <Button size="sm" variant="outline" onClick={() => { setFlagDialog(flag); setActionNotes(''); }}>
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-green-400">{flag.status}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge score={flag.confidence_score} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DRAFTS TAB ═══ */}
        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-yellow-400" />
                Invoice Drafts {drafts?.length ? `(${drafts.length})` : ''}
              </CardTitle>
              <CardDescription>
                AI-generated invoice drafts. Approve → Finalize (two-step gate).
                Nothing touches revenue until you confirm finalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!drafts?.length ? (
                <p className="text-center py-8 text-muted-foreground">
                  {selectedBatchId ? 'No invoice drafts generated' : 'Parse notes to generate drafts'}
                </p>
              ) : drafts.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  locked={isBatchClosed}
                  onReview={() => { setDraftDialog(draft); setActionNotes(''); }}
                  onFinalize={() => { setFinalizeDialog(draft); setActionNotes(''); }}
                  onCreateInvoice={() => { setConfirmFinalizeDialog(draft); }}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RECONCILIATION TAB ═══ */}
        <TabsContent value="recon">
          <div className="space-y-4">
            {/* Mode Toggle */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={strictMode} onCheckedChange={setStrictMode} />
                      <span className="text-sm font-medium flex items-center gap-1">
                        {strictMode ? (
                          <><ShieldCheck className="h-4 w-4 text-emerald-400" /> STRICT VERIFICATION</>
                        ) : (
                          <><GitCompare className="h-4 w-4 text-purple-400" /> Normal Reconciliation</>
                        )}
                      </span>
                    </div>
                    {strictMode && (
                      <p className="text-xs text-muted-foreground">
                        Only confirmed mismatches • Confidence ≥ 80% • No fuzzy noise
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!strictMode ? (
                      <Button
                        onClick={() => selectedBatchId && runReconciliation.mutateAsync(selectedBatchId)}
                        disabled={!selectedBatchId || runReconciliation.isPending || isBatchClosed}
                        className="gap-2"
                      >
                        {runReconciliation.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Reconciling...</>
                        ) : (
                          <><GitCompare className="h-4 w-4" /> Run Reconciliation</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={async () => {
                          if (!selectedBatchId) return;
                          const result = await strictVerify.mutateAsync(selectedBatchId);
                          // Auto-transition to verified_clean if zero issues
                          if (result.status === 'verified_clean' && batchStatus === 'under_review') {
                            await updateBatchStatus.mutateAsync({ batchId: selectedBatchId, newStatus: 'verified_clean' });
                          }
                        }}
                        disabled={!selectedBatchId || strictVerify.isPending || isBatchClosed}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {strictVerify.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                        ) : (
                          <><ShieldCheck className="h-4 w-4" /> Run Strict Verification</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strict Mode: Verification Summary */}
            {strictMode && snapshots && snapshots.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    Verification Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {(() => {
                      const totals = snapshots.reduce((acc, s) => ({
                        deliveries: acc.deliveries + (s.summary?.total_deliveries || 0),
                        matched: acc.matched + (s.summary?.matched || 0),
                        missingInv: acc.missingInv + (s.summary?.missing_invoices || 0),
                        missingNote: acc.missingNote + (s.summary?.missing_notes || 0),
                        dupes: acc.dupes + (s.summary?.duplicate_risks || 0),
                      }), { deliveries: 0, matched: 0, missingInv: 0, missingNote: 0, dupes: 0 });

                      const allClean = totals.missingInv === 0 && totals.missingNote === 0 && totals.dupes === 0;

                      return (
                        <>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold">{totals.deliveries}</p>
                            <p className="text-xs text-muted-foreground">Total Deliveries</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{totals.matched}</p>
                            <p className="text-xs text-muted-foreground">Matched ✅</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className={`text-2xl font-bold ${totals.missingInv > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {totals.missingInv}
                            </p>
                            <p className="text-xs text-muted-foreground">Missing Invoices</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <p className={`text-2xl font-bold ${totals.missingNote > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                              {totals.missingNote}
                            </p>
                            <p className="text-xs text-muted-foreground">Missing Notes</p>
                          </div>
                          {allClean && (
                            <div className="col-span-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                              <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                              <p className="text-sm font-semibold text-emerald-400">
                                100% of deliveries are accounted for.
                              </p>
                              <p className="text-xs text-muted-foreground">Provable. Not probable.</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Per-store breakdown */}
                  <div className="space-y-2">
                    {snapshots.map(snap => (
                      <div key={snap.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {snap.status === 'verified' ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-red-400" />
                          )}
                          <span className="text-sm font-medium">
                            Store {snap.store_id?.substring(0, 8)}...
                          </span>
                          <Badge variant={snap.status === 'verified' ? 'default' : 'destructive'} className="text-xs">
                            {snap.status === 'verified' ? 'CLEAN' : 'ISSUES'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{snap.summary?.total_deliveries || 0} deliveries</span>
                          <span className="text-emerald-400">{snap.summary?.matched || 0} matched</span>
                          {(snap.summary?.missing_invoices || 0) > 0 && (
                            <span className="text-red-400">{snap.summary.missing_invoices} missing inv</span>
                          )}
                          {(snap.summary?.missing_notes || 0) > 0 && (
                            <span className="text-yellow-400">{snap.summary.missing_notes} missing notes</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {strictMode ? (
                    <><ShieldCheck className="h-5 w-5 text-emerald-400" /> Confirmed Issues {filteredReconResults?.length ? `(${filteredReconResults.length})` : ''}</>
                  ) : (
                    <><GitCompare className="h-5 w-5 text-purple-400" /> Reconciliation Results {filteredReconResults?.length ? `(${filteredReconResults.length})` : ''}</>
                  )}
                </CardTitle>
                <CardDescription>
                  {strictMode
                    ? 'Only confirmed mismatches with ≥80% confidence. Every action requires manual confirmation.'
                    : 'Cross-references parsed events against existing invoices and CRM notes.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedBatchId ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Select a batch from History tab first
                  </p>
                ) : !filteredReconResults?.length ? (
                  <p className="text-center py-8 text-muted-foreground">
                    {(runReconciliation.isPending || strictVerify.isPending)
                      ? 'Running...'
                      : strictMode
                        ? 'No confirmed issues. Run Strict Verification to check.'
                        : 'No reconciliation results yet. Run Reconciliation to start.'
                    }
                  </p>
                ) : (
                  <StrictReconResultsList
                    results={filteredReconResults}
                    strictMode={strictMode}
                    locked={isBatchClosed}
                    onApply={(id) => applyRecon.mutateAsync({ resultId: id, action: 'approve' })}
                    onReject={(id, reason) => applyRecon.mutateAsync({ resultId: id, action: 'reject', notes: reason })}
                    isApplying={applyRecon.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ PROFILE ENRICHMENT TAB ═══ */}
        <TabsContent value="enrichment">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-400" />
                    <span className="text-sm font-medium">Profile Enrichment Engine</span>
                    <span className="text-xs text-muted-foreground">
                      Detect missing contacts, phones, emails & addresses from parsed notes
                    </span>
                  </div>
                  <Button
                    onClick={() => selectedBatchId && runEnrichment.mutateAsync(selectedBatchId)}
                    disabled={!selectedBatchId || runEnrichment.isPending || isBatchClosed}
                    className="gap-2"
                  >
                    {runEnrichment.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</>
                    ) : (
                      <><UserPlus className="h-4 w-4" /> Run Enrichment Scan</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Enrichment Summary */}
            {enrichmentCandidates && enrichmentCandidates.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <UserPlus className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                  <p className="text-2xl font-bold">{enrichmentCandidates.filter(c => c.enrichment_type === 'new_contact').length}</p>
                  <p className="text-xs text-muted-foreground">New Contacts</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Phone className="h-5 w-5 mx-auto mb-1 text-green-400" />
                  <p className="text-2xl font-bold">{enrichmentCandidates.filter(c => c.enrichment_type === 'new_phone').length}</p>
                  <p className="text-xs text-muted-foreground">New Phones</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Mail className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                  <p className="text-2xl font-bold">{enrichmentCandidates.filter(c => c.enrichment_type === 'new_email').length}</p>
                  <p className="text-xs text-muted-foreground">New Emails</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <MapPin className="h-5 w-5 mx-auto mb-1 text-orange-400" />
                  <p className="text-2xl font-bold">{enrichmentCandidates.filter(c => c.enrichment_type === 'new_address').length}</p>
                  <p className="text-xs text-muted-foreground">New Addresses</p>
                </div>
              </div>
            )}

            {/* Pending candidates requiring action */}
            {(() => {
              const pending = (enrichmentCandidates || []).filter(c => c.status === 'pending');
              const resolved = (enrichmentCandidates || []).filter(c => c.status !== 'pending');

              const ENRICHMENT_ICONS: Record<string, any> = {
                new_contact: UserPlus,
                new_phone: Phone,
                new_email: Mail,
                new_address: MapPin,
              };

              const ENRICHMENT_COLORS: Record<string, string> = {
                new_contact: 'text-blue-400',
                new_phone: 'text-green-400',
                new_email: 'text-purple-400',
                new_address: 'text-orange-400',
              };

              const ENRICHMENT_LABELS: Record<string, string> = {
                new_contact: 'New Contact',
                new_phone: 'New Phone',
                new_email: 'New Email',
                new_address: 'New Address',
              };

              if (!selectedBatchId) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Select a batch from History tab first
                    </CardContent>
                  </Card>
                );
              }

              if (!enrichmentCandidates?.length) {
                return (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No enrichment candidates found. Run Enrichment Scan to detect missing profile data.
                    </CardContent>
                  </Card>
                );
              }

              return (
                <>
                  {pending.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-yellow-400" />
                          Pending Review ({pending.length})
                        </CardTitle>
                        <CardDescription>
                          Each candidate requires explicit approval before CRM data is modified.
                          {isBatchClosed && ' (Batch closed — view only)'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {pending.map(candidate => {
                          const Icon = ENRICHMENT_ICONS[candidate.enrichment_type] || UserPlus;
                          const color = ENRICHMENT_COLORS[candidate.enrichment_type] || 'text-muted-foreground';
                          const val = candidate.extracted_value as Record<string, any>;
                          const isLowConf = candidate.confidence_score < 70;

                          return (
                            <div key={candidate.id} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${color}`} />
                                  <Badge variant="outline" className="text-xs">
                                    {ENRICHMENT_LABELS[candidate.enrichment_type]}
                                  </Badge>
                                  <span className="text-sm font-medium">
                                    Store: {candidate.store_id.substring(0, 8)}...
                                  </span>
                                  <ConfidenceBadge score={candidate.confidence_score} />
                                  {isLowConf && (
                                    <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                                      ⚠️ Low confidence
                                    </Badge>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {candidate.recommended_action}
                                </Badge>
                              </div>

                              {/* Extracted data display */}
                              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                                {candidate.enrichment_type === 'new_contact' && (
                                  <>
                                    <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{val.name}</span></p>
                                    {val.role && <p><span className="text-muted-foreground">Role:</span> {val.role}</p>}
                                    {val.context && <p className="text-xs text-muted-foreground mt-1">Context: "{val.context}"</p>}
                                  </>
                                )}
                                {candidate.enrichment_type === 'new_phone' && (
                                  <p><span className="text-muted-foreground">Phone:</span> <span className="font-medium font-mono">{val.phone}</span></p>
                                )}
                                {candidate.enrichment_type === 'new_email' && (
                                  <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{val.email}</span></p>
                                )}
                                {candidate.enrichment_type === 'new_address' && (
                                  <>
                                    <p><span className="text-muted-foreground">Address:</span> <span className="font-medium">{val.address}</span></p>
                                    <p className="text-xs text-muted-foreground">Type: {val.type || 'secondary'}</p>
                                  </>
                                )}
                              </div>

                              {/* Action buttons */}
                              {!isBatchClosed && (
                                <div className="flex items-center gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => processEnrichment.mutateAsync({
                                      candidateId: candidate.id,
                                      action: 'reject',
                                      rejectionReason: 'Manually rejected',
                                    })}
                                    disabled={processEnrichment.isPending}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => processEnrichment.mutateAsync({
                                      candidateId: candidate.id,
                                      action: 'approve',
                                    })}
                                    disabled={processEnrichment.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" /> Approve & Apply
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {resolved.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Resolved ({resolved.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {resolved.map(candidate => {
                          const Icon = ENRICHMENT_ICONS[candidate.enrichment_type] || UserPlus;
                          const val = candidate.extracted_value as Record<string, any>;
                          return (
                            <div key={candidate.id} className="border rounded-lg p-3 opacity-60 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {val.name || val.phone || val.email || val.address || 'Unknown'}
                                </span>
                              </div>
                              <Badge variant={candidate.status === 'applied' ? 'default' : 'secondary'} className="text-xs">
                                {candidate.status === 'applied' ? '✅ Applied' : '❌ Rejected'}
                              </Badge>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}

            <div className="bg-muted/30 border border-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                ⚠️ This system NEVER auto-modifies store data. All changes require explicit approval and are logged to the audit trail.
                Primary addresses and phones are never overwritten — new data is added as secondary records.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>Previous parse batches and their lifecycle status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Parse Status</TableHead>
                    <TableHead>Batch Status</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Drafts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!batches?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No audit batches yet
                      </TableCell>
                    </TableRow>
                  ) : batches.map(batch => (
                    <TableRow key={batch.id} className={selectedBatchId === batch.id ? 'bg-muted/50' : ''}>
                      <TableCell className="text-sm">
                        {format(new Date(batch.created_at), 'MMM d, yyyy, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'failed' ? 'destructive' : 'secondary'}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <BatchStatusBadge status={batch.batch_status} />
                      </TableCell>
                      <TableCell className="text-sm">{batch.totals?.events_created ?? 0}</TableCell>
                      <TableCell className="text-sm">{batch.totals?.flags_created ?? 0}</TableCell>
                      <TableCell className="text-sm">{batch.totals?.drafts_created ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedBatchId(batch.id);
                              setActiveTab('events');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          {batch.batch_status === 'open' && batch.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateBatchStatus.mutateAsync({ batchId: batch.id, newStatus: 'under_review' })}
                              disabled={updateBatchStatus.isPending}
                            >
                              Start Review
                            </Button>
                          )}
                          {batch.batch_status === 'verified_clean' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500/50 text-emerald-400"
                              onClick={() => updateBatchStatus.mutateAsync({ batchId: batch.id, newStatus: 'closed' })}
                              disabled={updateBatchStatus.isPending}
                            >
                              <LockKeyhole className="h-3 w-3 mr-1" /> Close Batch
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ DRAFT REVIEW DIALOG ═══ */}
      <Dialog open={!!draftDialog} onOpenChange={(o) => !o && setDraftDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Invoice Draft</DialogTitle>
            <DialogDescription>
              Approve to prepare for finalization, or reject to discard.
            </DialogDescription>
          </DialogHeader>
          {draftDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Store:</span>{' '}
                  <span className="font-medium">{draftDialog.notes || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  <span>{draftDialog.invoice_date || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span className="font-bold">${draftDialog.total ?? 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment:</span>{' '}
                  <Badge variant="outline">{draftDialog.payment_status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Currency:</span>{' '}
                  <span>{draftDialog.currency}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence:</span>{' '}
                  <ConfidenceBadge score={draftDialog.confidence_score} />
                </div>
              </div>

              {/* Line Items */}
              {Array.isArray(draftDialog.line_items) && draftDialog.line_items.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Line Items:</p>
                  <div className="space-y-1">
                    {draftDialog.line_items.map((li, i) => (
                      <div key={i} className="text-sm text-muted-foreground flex justify-between">
                        <span>{li.brand || li.product || 'Item'} × {li.qty_raw || li.qty || '?'}</span>
                        <span>${li.line_total || '?'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source excerpt */}
              {draftDialog.source_raw_excerpt && (
                <div>
                  <p className="text-sm font-medium mb-1">Source Notes:</p>
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                    {draftDialog.source_raw_excerpt}
                  </p>
                </div>
              )}

              <Textarea
                placeholder="Review notes (optional)..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="min-h-[60px]"
              />

              <p className="text-xs text-muted-foreground">
                ⚠️ Approving does NOT create a live invoice. It marks this draft as ready for finalization.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleDraftAction('reject')} disabled={processDraft.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => handleDraftAction('approve')} disabled={processDraft.isPending} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-1" /> Approve Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ FLAG RESOLVE DIALOG ═══ */}
      <Dialog open={!!flagDialog} onOpenChange={(o) => !o && setFlagDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>
              {flagDialog && (FLAG_TYPE_LABELS[flagDialog.flag_type] || flagDialog.flag_type)}
            </DialogDescription>
          </DialogHeader>
          {flagDialog && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{flagDialog.title}</p>
              <p className="text-sm text-muted-foreground">{flagDialog.description}</p>
              <Textarea
                placeholder="Resolution notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleResolveFlag('dismiss')} disabled={resolveFlag.isPending}>
              Dismiss
            </Button>
            <Button onClick={() => handleResolveFlag('resolve')} disabled={resolveFlag.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ FINALIZE CONFIRMATION DIALOG ═══ */}
      <Dialog open={!!finalizeDialog} onOpenChange={(o) => !o && setFinalizeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-500" />
              Confirm Finalization Intent
            </DialogTitle>
            <DialogDescription>
              This will prepare this draft for live invoice creation. Revenue, commissions, and inventory
              will be affected only after the final confirmation step.
            </DialogDescription>
          </DialogHeader>
          {finalizeDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store:</span>
                  <span className="font-medium">{finalizeDialog.notes || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-bold text-lg">${finalizeDialog.total ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Items:</span>
                  <span>{finalizeDialog.line_items?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <Badge variant="outline">{finalizeDialog.payment_status}</Badge>
                </div>
              </div>

              <Textarea
                placeholder="Finalization notes (optional)..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="min-h-[60px]"
              />

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-400">
                  ⚠️ After confirming intent, the "Create Live Invoice" step will generate a real invoice
                  in the accounting system. This action is irreversible.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeDialog(null)}>Cancel</Button>
            <Button onClick={handleFinalizeIntent} disabled={finalizeIntent.isPending} className="bg-yellow-600 hover:bg-yellow-700">
              <Lock className="h-4 w-4 mr-1" /> Prepare Finalization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE LIVE INVOICE CONFIRMATION ═══ */}
      <Dialog open={!!confirmFinalizeDialog} onOpenChange={(o) => !o && setConfirmFinalizeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Create Live Invoice — Final Confirmation
            </DialogTitle>
            <DialogDescription>
              This will create a REAL invoice in the accounting system. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          {confirmFinalizeDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store:</span>
                  <span className="font-medium">{confirmFinalizeDialog.notes || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-bold text-lg">${confirmFinalizeDialog.total ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Items:</span>
                  <span>{confirmFinalizeDialog.line_items?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <Badge variant="outline">{confirmFinalizeDialog.payment_status}</Badge>
                </div>
              </div>

              {(!confirmFinalizeDialog.total || confirmFinalizeDialog.total <= 0) && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs text-destructive">
                    ❌ Cannot finalize: total is zero or missing. Edit the draft first.
                  </p>
                </div>
              )}
              {(!confirmFinalizeDialog.line_items?.length) && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs text-destructive">
                    ❌ Cannot finalize: no line items. Edit the draft first.
                  </p>
                </div>
              )}
              {(!confirmFinalizeDialog.store_id) && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  <p className="text-xs text-destructive">
                    ❌ Cannot finalize: no linked store. Link a store first.
                  </p>
                </div>
              )}

              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-xs text-destructive font-medium">
                  ⚠️ This will create a live invoice record. Revenue will be affected. This cannot be undone.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFinalizeDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleCreateLiveInvoice}
              disabled={
                finalizeDraft.isPending ||
                !confirmFinalizeDialog?.total ||
                confirmFinalizeDialog.total <= 0 ||
                !confirmFinalizeDialog?.line_items?.length ||
                !confirmFinalizeDialog?.store_id
              }
            >
              {finalizeDraft.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating...</>
              ) : (
                <><FileText className="h-4 w-4 mr-1" /> Create Live Invoice</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    under_review: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    verified_clean: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    closed: 'bg-muted text-muted-foreground border-muted',
  };
  const icons: Record<string, string> = {
    open: '📂',
    under_review: '🔍',
    verified_clean: '✅',
    closed: '🔒',
  };
  return (
    <Badge className={styles[status] || 'bg-muted'}>
      {icons[status] || ''} {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ═══ Sub-Components ═══

function MetricCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color || ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-mono font-medium ${color}`}>{score}%</span>;
}

function DraftCard({ draft, locked = false, onReview, onFinalize, onCreateInvoice }: {
  draft: AuditInvoiceDraft;
  locked?: boolean;
  onReview: () => void;
  onFinalize: () => void;
  onCreateInvoice: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/15 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  const finalizeColors: Record<string, string> = {
    not_finalized: '',
    ready_to_finalize: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    finalized: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-yellow-400" />
          <span className="font-medium">{draft.notes || 'Unknown Store'}</span>
          <Badge className={statusColors[draft.approval_status] || ''}>{draft.approval_status}</Badge>
          {draft.finalize_status !== 'not_finalized' && (
            <Badge className={finalizeColors[draft.finalize_status] || ''}>{draft.finalize_status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">${draft.total ?? 0}</span>
          {!locked && draft.approval_status === 'pending' && (
            <Button size="sm" onClick={onReview}>Review</Button>
          )}
          {!locked && draft.finalize_status === 'ready_to_finalize' && (
            <>
              <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400" onClick={onFinalize}>
                <Lock className="h-3 w-3 mr-1" /> Prepare
              </Button>
              <Button size="sm" variant="destructive" onClick={onCreateInvoice}>
                <FileText className="h-3 w-3 mr-1" /> Create Invoice
              </Button>
            </>
          )}
          {draft.finalize_status === 'finalized' && (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <CheckCircle className="h-3 w-3 mr-1" /> Finalized ✅
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground">
        <div>📅 {draft.invoice_date || 'No date'}</div>
        <div>📦 {draft.line_items?.length || 0} items</div>
        <div>💳 {draft.payment_status}</div>
        <div><ConfidenceBadge score={draft.confidence_score} /></div>
      </div>
      {draft.finalized_invoice_id && (
        <div className="mt-2 text-xs text-emerald-400">
          Invoice ID: {draft.finalized_invoice_id}
        </div>
      )}
    </div>
  );
}

const RECON_TYPE_LABELS: Record<string, string> = {
  missing_note: '📝 Missing Note',
  missing_invoice: '🧾 Missing Invoice',
  orphan_invoice: '👻 Orphan Invoice',
  amount_mismatch: '💲 Amount Mismatch',
  payment_mismatch: '💰 Payment Mismatch',
  duplicate_risk: '🔁 Duplicate Risk',
};

const RECON_ACTION_LABELS: Record<string, string> = {
  create_note: 'Create Note',
  create_invoice: 'Create Invoice',
  update_invoice: 'Update Invoice',
  mark_paid: 'Mark Paid',
  merge: 'Merge',
  review: 'Review',
};

const RECON_TYPE_COLORS: Record<string, string> = {
  missing_note: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  missing_invoice: 'bg-red-500/15 text-red-400 border-red-500/30',
  orphan_invoice: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  amount_mismatch: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  payment_mismatch: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  duplicate_risk: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

function StrictReconResultsList({ results, strictMode, locked = false, onApply, onReject, isApplying }: {
  results: AuditReconciliationResult[];
  strictMode: boolean;
  locked?: boolean;
  onApply: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  isApplying: boolean;
}) {
  const [ignoreDialogId, setIgnoreDialogId] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [lowConfirmChecked, setLowConfirmChecked] = useState<Record<string, boolean>>({});

  // Group by type
  const grouped = results.reduce((acc, r) => {
    (acc[r.reconciliation_type] = acc[r.reconciliation_type] || []).push(r);
    return acc;
  }, {} as Record<string, AuditReconciliationResult[]>);

  const handleIgnore = () => {
    if (!ignoreDialogId || (strictMode && !ignoreReason.trim())) return;
    onReject(ignoreDialogId, ignoreReason || undefined);
    setIgnoreDialogId(null);
    setIgnoreReason('');
  };

  return (
    <>
      <div className="space-y-6">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Badge className={RECON_TYPE_COLORS[type] || 'bg-muted'}>
                {RECON_TYPE_LABELS[type] || type}
              </Badge>
              <span className="text-muted-foreground text-xs">({items.length})</span>
            </h3>
            {items.map(item => {
              const requiresManualConfirm = item.evidence?.requires_manual_confirm || (item.evidence?.amount_difference && item.evidence.amount_difference > 10);
              const isLowConf = item.confidence_score < 60;
              const needsSecondary = strictMode && isLowConf;

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    item.status === 'applied' || item.status === 'rejected' ? 'opacity-50' : ''
                  }`}
                >
                  {/* Three-column layout: Event / Invoice / Note summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Delivery Summary</p>
                      <p className="text-sm">{item.event_summary || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Invoice Summary</p>
                      <p className="text-sm">{item.invoice_summary || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Why It Failed</p>
                      <p className="text-sm text-muted-foreground">
                        {item.evidence?.strict_mode
                          ? `Strict: ${item.reconciliation_type.replace(/_/g, ' ')}`
                          : item.reconciliation_type.replace(/_/g, ' ')
                        }
                        {item.evidence?.amount_difference != null && ` (Δ$${item.evidence.amount_difference.toFixed(2)})`}
                        {item.evidence?.invoices_checked != null && ` • ${item.evidence.invoices_checked} invoices checked`}
                        {item.evidence?.notes_checked != null && ` • ${item.evidence.notes_checked} notes checked`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {RECON_ACTION_LABELS[item.recommended_action] || item.recommended_action}
                      </Badge>
                      <ConfidenceBadge score={item.confidence_score} />
                      {requiresManualConfirm && (
                        <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                          ⚠️ Manual confirm required
                        </Badge>
                      )}
                      {item.evidence?.strict_mode && (
                        <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                          STRICT
                        </Badge>
                      )}
                      {item.status !== 'open' && (
                        <Badge variant={item.status === 'applied' ? 'default' : 'secondary'} className="text-xs">
                          {item.status}
                        </Badge>
                      )}
                    </div>

                    {item.status === 'open' && !locked && (
                      <div className="flex items-center gap-2 shrink-0">
                        {needsSecondary && (
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={lowConfirmChecked[item.id] || false}
                              onChange={(e) => setLowConfirmChecked(prev => ({ ...prev, [item.id]: e.target.checked }))}
                              className="rounded"
                            />
                            I confirm low-confidence action
                          </label>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (strictMode) {
                              setIgnoreDialogId(item.id);
                              setIgnoreReason('');
                            } else {
                              onReject(item.id);
                            }
                          }}
                          disabled={isApplying}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Ignore
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onApply(item.id)}
                          disabled={isApplying || (needsSecondary && !lowConfirmChecked[item.id])}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {item.recommended_action === 'create_invoice' ? 'Create Invoice' :
                           item.recommended_action === 'create_note' ? 'Create Note' :
                           item.recommended_action === 'mark_paid' ? 'Fix Payment' :
                           'Apply'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Ignore reason dialog (strict mode requires reason) */}
      <Dialog open={!!ignoreDialogId} onOpenChange={(o) => !o && setIgnoreDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignore Issue — Reason Required</DialogTitle>
            <DialogDescription>
              Strict mode requires a documented reason for ignoring any finding.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Why is this being ignored? e.g., 'Duplicate entry from previous batch' or 'Store confirmed verbally'"
            value={ignoreReason}
            onChange={(e) => setIgnoreReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreDialogId(null)}>Cancel</Button>
            <Button
              onClick={handleIgnore}
              disabled={!ignoreReason.trim()}
            >
              Confirm Ignore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
