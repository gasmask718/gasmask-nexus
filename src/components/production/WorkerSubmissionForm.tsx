/**
 * WORKER SUBMISSION FORM
 * 
 * Workers submit production logs: lbs, tubes, boxes, defects, waste, downtime.
 * Submissions are created as pending_review — they do NOT mutate inventory directly.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ClipboardCheck, Send, Loader2 } from 'lucide-react';
import { useCreateSubmission } from '@/hooks/useWorkerSubmissions';
import { useTodayBatches } from '@/hooks/useProductionPortal';

interface WorkerSubmissionFormProps {
  officeId: string;
  workerId?: string;
}

export function WorkerSubmissionForm({ officeId, workerId }: WorkerSubmissionFormProps) {
  const { data: batches = [] } = useTodayBatches(officeId);
  const createSubmission = useCreateSubmission();

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [lbsProcessed, setLbsProcessed] = useState('');
  const [tubesProduced, setTubesProduced] = useState('');
  const [boxesPacked, setBoxesPacked] = useState('');
  const [bagsCleaned, setBagsCleaned] = useState('0');
  const [defectsCount, setDefectsCount] = useState('0');
  const [defectReason, setDefectReason] = useState('');
  const [wasteLbs, setWasteLbs] = useState('0');
  const [downtimeMinutes, setDowntimeMinutes] = useState('0');
  const [downtimeReason, setDowntimeReason] = useState('');
  const [qualityCheckPassed, setQualityCheckPassed] = useState(true);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setSelectedBatchId('');
    setLbsProcessed('');
    setTubesProduced('');
    setBoxesPacked('');
    setBagsCleaned('0');
    setDefectsCount('0');
    setDefectReason('');
    setWasteLbs('0');
    setDowntimeMinutes('0');
    setDowntimeReason('');
    setQualityCheckPassed(true);
    setNotes('');
  };

  const handleSubmit = () => {
    if (!selectedBatchId) return;

    createSubmission.mutate({
      batch_id: selectedBatchId,
      office_id: officeId,
      worker_id: workerId,
      lbs_processed: parseFloat(lbsProcessed) || 0,
      tubes_produced: parseInt(tubesProduced) || 0,
      boxes_packed: parseInt(boxesPacked) || 0,
      bags_cleaned: parseInt(bagsCleaned) || 0,
      defects_count: parseInt(defectsCount) || 0,
      defect_reason: defectReason || undefined,
      waste_lbs: parseFloat(wasteLbs) || 0,
      downtime_minutes: parseInt(downtimeMinutes) || 0,
      downtime_reason: downtimeReason || undefined,
      quality_check_passed: qualityCheckPassed,
      notes: notes || undefined,
    }, {
      onSuccess: resetForm,
    });
  };

  const canSubmit = selectedBatchId && (
    parseFloat(lbsProcessed) > 0 || 
    parseInt(tubesProduced) > 0 || 
    parseInt(boxesPacked) > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Submit Production Log
        </CardTitle>
        <CardDescription>
          Log your production output. Submissions require manager approval before updating inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch Selection */}
        <div className="space-y-2">
          <Label>Active Batch *</Label>
          <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
            <SelectTrigger>
              <SelectValue placeholder="Select batch..." />
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id}>
                  <span className="flex items-center gap-2">
                    {batch.brand}
                    <Badge variant="outline" className="text-xs">
                      {batch.inventory_state || batch.status}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {batches.length === 0 && (
            <p className="text-xs text-muted-foreground">No active batches today. Ask your manager to create one.</p>
          )}
        </div>

        {/* Production Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Lbs Processed</Label>
            <Input
              type="number"
              step="0.1"
              value={lbsProcessed}
              onChange={(e) => setLbsProcessed(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div className="space-y-2">
            <Label>Tubes Produced</Label>
            <Input
              type="number"
              value={tubesProduced}
              onChange={(e) => setTubesProduced(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Boxes Packed</Label>
            <Input
              type="number"
              value={boxesPacked}
              onChange={(e) => setBoxesPacked(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Bags Cleaned</Label>
            <Input
              type="number"
              value={bagsCleaned}
              onChange={(e) => setBagsCleaned(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Defects & Waste */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Defects</Label>
            <Input
              type="number"
              value={defectsCount}
              onChange={(e) => setDefectsCount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Waste (lbs)</Label>
            <Input
              type="number"
              step="0.1"
              value={wasteLbs}
              onChange={(e) => setWasteLbs(e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        {parseInt(defectsCount) > 0 && (
          <div className="space-y-2">
            <Label>Defect Reason</Label>
            <Textarea
              value={defectReason}
              onChange={(e) => setDefectReason(e.target.value)}
              placeholder="Describe the defect..."
              rows={2}
            />
          </div>
        )}

        {/* Downtime */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Downtime (minutes)</Label>
            <Input
              type="number"
              value={downtimeMinutes}
              onChange={(e) => setDowntimeMinutes(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2 flex items-end gap-2 pb-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={qualityCheckPassed}
                onCheckedChange={setQualityCheckPassed}
              />
              <Label className="text-sm">QC Passed</Label>
            </div>
          </div>
        </div>

        {parseInt(downtimeMinutes) > 0 && (
          <div className="space-y-2">
            <Label>Downtime Reason</Label>
            <Textarea
              value={downtimeReason}
              onChange={(e) => setDowntimeReason(e.target.value)}
              placeholder="Explain downtime..."
              rows={2}
            />
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about this shift..."
            rows={3}
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            Requires Manager Approval
          </Badge>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || createSubmission.isPending}
          >
            {createSubmission.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Submit for Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
