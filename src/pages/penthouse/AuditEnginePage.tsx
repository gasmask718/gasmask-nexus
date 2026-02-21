import { useState } from 'react';
import { format } from 'date-fns';
import {
  Shield, Search, FileText, AlertTriangle, FileWarning, Loader2,
  CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Send,
  TrendingUp, DollarSign, AlertCircle, ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  useParseNotes,
  useAuditBatches,
  useAuditEvents,
  useAuditFlags,
  useAuditDrafts,
  useAuditMetrics,
  useProcessDraft,
  useResolveFlag,
  type AuditInvoiceDraft,
  type AuditFlag,
} from '@/hooks/useAuditEngine';

// ═══ Severity Colors ═══
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
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  delivery: 'bg-green-500/15 text-green-400',
  payment: 'bg-emerald-500/15 text-emerald-400',
  visit: 'bg-blue-500/15 text-blue-400',
  order_request: 'bg-purple-500/15 text-purple-400',
  unpaid_balance: 'bg-red-500/15 text-red-400',
  sticker_check: 'bg-yellow-500/15 text-yellow-400',
  sample_drop: 'bg-cyan-500/15 text-cyan-400',
  switch_tubes: 'bg-orange-500/15 text-orange-400',
  other: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
};

export default function AuditEnginePage() {
  const [rawText, setRawText] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('ingest');
  const [draftDialog, setDraftDialog] = useState<AuditInvoiceDraft | null>(null);
  const [flagDialog, setFlagDialog] = useState<AuditFlag | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const parseNotes = useParseNotes();
  const { data: batches } = useAuditBatches();
  const { data: events } = useAuditEvents(selectedBatchId);
  const { data: flags } = useAuditFlags(selectedBatchId);
  const { data: drafts } = useAuditDrafts(selectedBatchId);
  const { data: metrics } = useAuditMetrics();
  const processDraft = useProcessDraft();
  const resolveFlag = useResolveFlag();

  const handleParse = async () => {
    if (!rawText.trim()) return;
    const result = await parseNotes.mutateAsync(rawText);
    setSelectedBatchId(result.batch_id);
    setActiveTab('events');
    setRawText('');
  };

  const handleDraftAction = async (action: 'approve' | 'reject') => {
    if (!draftDialog) return;
    await processDraft.mutateAsync({
      draftId: draftDialog.id,
      action,
      notes: actionNotes,
      rejectionReason: action === 'reject' ? actionNotes : undefined,
    });
    setDraftDialog(null);
    setActionNotes('');
  };

  const handleResolveFlag = async () => {
    if (!flagDialog) return;
    await resolveFlag.mutateAsync({ flagId: flagDialog.id, notes: actionNotes });
    setFlagDialog(null);
    setActionNotes('');
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard icon={ClipboardList} label="Events Parsed" value={metrics?.totalEvents || 0} />
        <MetricCard icon={AlertTriangle} label="Open Flags" value={metrics?.openFlags || 0} color="text-orange-400" />
        <MetricCard icon={FileText} label="Pending Drafts" value={metrics?.pendingDrafts || 0} color="text-yellow-400" />
        <MetricCard icon={CheckCircle} label="Approved" value={metrics?.approvedDrafts || 0} color="text-green-400" />
        <MetricCard icon={DollarSign} label="Est. Recovery" value={`$${(metrics?.estimatedRecovery || 0).toLocaleString()}`} color="text-emerald-400" />
        <MetricCard icon={FileWarning} label="Missing Invoices" value={metrics?.missingInvoices || 0} color="text-red-400" />
        <MetricCard icon={TrendingUp} label="Unmatched $" value={metrics?.unmatchedPayments || 0} color="text-purple-400" />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="ingest">📥 Ingest</TabsTrigger>
          <TabsTrigger value="events">📋 Events</TabsTrigger>
          <TabsTrigger value="flags">🔎 Flags</TabsTrigger>
          <TabsTrigger value="drafts">🧾 Drafts</TabsTrigger>
          <TabsTrigger value="history">📂 History</TabsTrigger>
        </TabsList>

        {/* ═══ INGEST TAB ═══ */}
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
                <Button
                  onClick={handleParse}
                  disabled={!rawText.trim() || parseNotes.isPending}
                  className="gap-2"
                >
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

          {/* AI Summary if just parsed */}
          {selectedBatchId && batches?.find(b => b.id === selectedBatchId)?.ai_summary && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-yellow-400 mb-1">🧠 AI Summary</p>
                <p className="text-sm text-muted-foreground">
                  {batches?.find(b => b.id === selectedBatchId)?.ai_summary}
                </p>
              </CardContent>
            </Card>
          )}
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
                    <TableHead>Store</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Payment</TableHead>
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
                        {evt.event_date ? format(new Date(evt.event_date), 'MMM d') : '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {evt.store_name_raw || '—'}
                        {evt.linked && <Badge variant="outline" className="ml-1 text-[10px]">Linked</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge className={EVENT_TYPE_COLORS[evt.event_type] || EVENT_TYPE_COLORS.unknown}>
                          {evt.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{evt.product || '—'}</TableCell>
                      <TableCell className="text-sm">{evt.quantity ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {evt.payment_amount ? `$${evt.payment_amount}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {evt.unpaid_balance ? (
                          <span className="text-red-400">${evt.unpaid_balance}</span>
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
                    flag.status === 'resolved' ? 'opacity-50' : ''
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
                    </div>
                    {flag.status === 'open' ? (
                      <Button size="sm" variant="outline" onClick={() => { setFlagDialog(flag); setActionNotes(''); }}>
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-green-400">Resolved</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
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
                AI-generated invoice drafts. Review and approve to create real invoices.
                Nothing touches revenue until you confirm.
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
                  onReview={() => { setDraftDialog(draft); setActionNotes(''); }}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ HISTORY TAB ═══ */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>Previous parse batches and their results</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Drafts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!batches?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit batches yet
                      </TableCell>
                    </TableRow>
                  ) : batches.map(batch => (
                    <TableRow key={batch.id} className={selectedBatchId === batch.id ? 'bg-muted/50' : ''}>
                      <TableCell className="text-sm">
                        {format(new Date(batch.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{batch.total_events}</TableCell>
                      <TableCell className="text-sm">{batch.total_flags}</TableCell>
                      <TableCell className="text-sm">{batch.total_drafts}</TableCell>
                      <TableCell>
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
                  <span className="font-medium">{draftDialog.store_name_inferred || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  <span>{draftDialog.inferred_date || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Brand:</span>{' '}
                  <span>{draftDialog.brand || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span className="font-bold">${draftDialog.estimated_total}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment:</span>{' '}
                  <Badge variant="outline">{draftDialog.payment_status_inferred}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence:</span>{' '}
                  <ConfidenceBadge score={draftDialog.confidence_score} />
                </div>
              </div>

              {/* Products */}
              {Array.isArray(draftDialog.products) && draftDialog.products.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Products:</p>
                  <div className="space-y-1">
                    {draftDialog.products.map((p: any, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground flex justify-between">
                        <span>{p.name} × {p.quantity}</span>
                        <span>${p.estimated_unit_price || '?'}/ea</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source notes */}
              {draftDialog.source_notes && (
                <div>
                  <p className="text-sm font-medium mb-1">Source Notes:</p>
                  <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
                    {draftDialog.source_notes}
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
            <Button
              variant="destructive"
              onClick={() => handleDraftAction('reject')}
              disabled={processDraft.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button
              onClick={() => handleDraftAction('approve')}
              disabled={processDraft.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
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
              <p className="text-sm text-muted-foreground">{flagDialog.description}</p>
              <Textarea
                placeholder="Resolution notes..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleResolveFlag} disabled={resolveFlag.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

function DraftCard({ draft, onReview }: { draft: AuditInvoiceDraft; onReview: () => void }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/15 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-yellow-400" />
          <span className="font-medium">{draft.store_name_inferred || 'Unknown Store'}</span>
          <Badge className={statusColors[draft.approval_status] || ''}>{draft.approval_status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">${draft.estimated_total}</span>
          {draft.approval_status === 'pending' && (
            <Button size="sm" onClick={onReview}>Review</Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm text-muted-foreground">
        <div>📅 {draft.inferred_date || 'No date'}</div>
        <div>🏷 {draft.brand || 'Unknown brand'}</div>
        <div>💳 {draft.payment_status_inferred}</div>
        <div><ConfidenceBadge score={draft.confidence_score} /></div>
      </div>
    </div>
  );
}
