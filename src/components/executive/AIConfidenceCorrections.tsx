// Phase 8: Confidence Correction Admin UI
// Create, approve, reject, rollback confidence correction profiles
// Executive/Admin only

import { useState } from 'react';
import { useConfidenceCorrections, type ConfidenceCorrection } from '@/hooks/useConfidenceCorrections';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';

export function AIConfidenceCorrections() {
  const {
    approvedCorrections,
    draftCorrections,
    rejectedCorrections,
    rolledBackCorrections,
    isLoading,
    translateConfidence,
    createDraft,
    approveDraft,
    rejectDraft,
    rollbackApproved,
  } = useConfidenceCorrections();

  const [formData, setFormData] = useState({
    scope_type: 'global',
    scope_value: '',
    confidence_min: '70',
    confidence_max: '90',
    display_offset: '-10',
    notes: '',
  });

  const handleCreateDraft = async () => {
    await createDraft.mutateAsync({
      scope_type: formData.scope_type as any,
      scope_value: formData.scope_value || null,
      confidence_min: parseInt(formData.confidence_min),
      confidence_max: parseInt(formData.confidence_max),
      display_offset: parseInt(formData.display_offset),
      notes: formData.notes || null,
    });

    setFormData({
      scope_type: 'global',
      scope_value: '',
      confidence_min: '70',
      confidence_max: '90',
      display_offset: '-10',
      notes: '',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'approved':
        return <Badge className="bg-green-600 text-white">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600 text-white">Rejected</Badge>;
      case 'rolled_back':
        return <Badge className="bg-yellow-600 text-white">Rolled Back</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const CorrectionRow = ({
    correction,
    allowApprove,
    allowReject,
    allowRollback,
  }: {
    correction: ConfidenceCorrection;
    allowApprove?: boolean;
    allowReject?: boolean;
    allowRollback?: boolean;
  }) => {
    const scopeDisplay =
      correction.scope_type === 'global'
        ? 'Global'
        : `${correction.scope_type}: ${correction.scope_value}`;

    const preview = translateConfidence(80, { sla: correction.scope_value || undefined });

    return (
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm">{scopeDisplay}</span>
              {getStatusBadge(correction.status)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Range:</span>
                <p className="font-semibold">
                  {correction.confidence_min}
                  {' '}
                  to
                  {' '}
                  {correction.confidence_max}
                  %
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Offset:</span>
                <p className="font-semibold">
                  {correction.display_offset > 0 ? '+' : ''}
                  {correction.display_offset}
                  %
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Preview (80%):</span>
                <p className="font-semibold">{preview.displayed}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="text-xs">{new Date(correction.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            {correction.notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {correction.notes}
              </p>
            )}
          </div>
        </div>

        {/* Warnings for aggressive offsets */}
        {Math.abs(correction.display_offset) > 20 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              Aggressive offset (
              {'>'}
              20). Verify calibration data.
            </span>
          </div>
        )}

        {/* Action buttons */}
        {allowApprove && (
          <Button
            size="sm"
            onClick={() => approveDraft.mutate(correction.id)}
            disabled={approveDraft.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {approveDraft.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve
          </Button>
        )}
        {allowReject && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => rejectDraft.mutate(correction.id)}
            disabled={rejectDraft.isPending}
            className="w-full"
          >
            {rejectDraft.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Reject
          </Button>
        )}
        {allowRollback && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => rollbackApproved.mutate(correction.id)}
            disabled={rollbackApproved.isPending}
            className="w-full"
          >
            {rollbackApproved.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Rollback
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-primary" />
          Confidence Corrections
        </h2>
        <p className="text-muted-foreground mt-1">
          Adjust displayed confidence based on Phase 7 calibration analysis. Display-only
          (no effect on scoring or sorting).
        </p>
      </div>

      {/* Create Draft Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Correction Profile</CardTitle>
          <CardDescription>
            Propose a new confidence correction rule for human review and approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scope_type">Scope Type</Label>
              <Select
                value={formData.scope_type}
                onValueChange={(val) => setFormData({ ...formData, scope_type: val })}
              >
                <SelectTrigger id="scope_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="sla">SLA Severity</SelectItem>
                  <SelectItem value="risk">Risk Level</SelectItem>
                  <SelectItem value="territory">Territory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.scope_type !== 'global' && (
              <div>
                <Label htmlFor="scope_value">Scope Value</Label>
                <Input
                  id="scope_value"
                  placeholder={
                    formData.scope_type === 'sla'
                      ? 'e.g., red'
                      : formData.scope_type === 'risk'
                        ? 'e.g., high'
                        : 'e.g., territory-1'
                  }
                  value={formData.scope_value}
                  onChange={(e) => setFormData({ ...formData, scope_value: e.target.value })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="confidence_min">Confidence Min (%)</Label>
              <Input
                id="confidence_min"
                type="number"
                min="0"
                max="100"
                value={formData.confidence_min}
                onChange={(e) => setFormData({ ...formData, confidence_min: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="confidence_max">Confidence Max (%)</Label>
              <Input
                id="confidence_max"
                type="number"
                min="0"
                max="100"
                value={formData.confidence_max}
                onChange={(e) => setFormData({ ...formData, confidence_max: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="display_offset">Display Offset (±%)</Label>
              <Input
                id="display_offset"
                type="number"
                min="-100"
                max="100"
                value={formData.display_offset}
                onChange={(e) => setFormData({ ...formData, display_offset: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                e.g., -10 shows 80% when raw is 90%
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Why is this correction needed? Reference Phase 7 calibration findings..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <Button
            onClick={handleCreateDraft}
            disabled={createDraft.isPending}
            className="w-full"
          >
            {createDraft.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Create Draft
          </Button>
        </CardContent>
      </Card>

      {/* Correction Lists by Status */}
      <Tabs defaultValue="approved" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approved">
            Approved (
            {approvedCorrections.length}
            )
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft (
            {draftCorrections.length}
            )
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected (
            {rejectedCorrections.length}
            )
          </TabsTrigger>
          <TabsTrigger value="rolled_back">
            Rolled Back (
            {rolledBackCorrections.length}
            )
          </TabsTrigger>
        </TabsList>

        {/* Approved Tab */}
        <TabsContent value="approved" className="space-y-4">
          {approvedCorrections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No approved corrections yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvedCorrections.map((c) => (
                <CorrectionRow
                  key={c.id}
                  correction={c}
                  allowRollback={true}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Draft Tab */}
        <TabsContent value="draft" className="space-y-4">
          {draftCorrections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No draft corrections.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {draftCorrections.map((c) => (
                <CorrectionRow
                  key={c.id}
                  correction={c}
                  allowApprove={true}
                  allowReject={true}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rejected Tab */}
        <TabsContent value="rejected" className="space-y-4">
          {rejectedCorrections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No rejected corrections.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rejectedCorrections.map((c) => (
                <CorrectionRow key={c.id} correction={c} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rolled Back Tab */}
        <TabsContent value="rolled_back" className="space-y-4">
          {rolledBackCorrections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No rolled back corrections.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rolledBackCorrections.map((c) => (
                <CorrectionRow key={c.id} correction={c} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Governance Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-primary">
              <p className="font-semibold mb-1">Display-Only Layer</p>
              <p>
                Confidence corrections adjust displayed confidence only. Raw confidence
                values and all dispatch, scoring, and sorting logic remain unchanged. This
                is a translation layer for user clarity and trust calibration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
