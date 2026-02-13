// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK REASON MODAL — Phase 5B: Human Feedback Reason Codes
// ═══════════════════════════════════════════════════════════════════════════════
// Optional, skippable, non-blocking. Telemetry only.

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, XCircle } from 'lucide-react';

const APPLIED_REASONS = [
  { code: 'ai_correct_priority', label: 'AI had the right priority' },
  { code: 'worker_available', label: 'Worker was available' },
  { code: 'sla_risk_real', label: 'SLA risk was real' },
  { code: 'route_efficiency', label: 'Route efficiency' },
  { code: 'matched_intuition', label: 'Matched my intuition' },
] as const;

const DISMISSED_REASONS = [
  { code: 'store_not_ready', label: 'Store not ready' },
  { code: 'worker_unavailable', label: 'Worker unavailable' },
  { code: 'incorrect_context', label: 'Incorrect context' },
  { code: 'already_handled', label: 'Already handled' },
  { code: 'low_confidence', label: 'Low confidence' },
  { code: 'manual_override', label: 'Manual override' },
] as const;

interface FeedbackReasonModalProps {
  open: boolean;
  onClose: () => void;
  feedbackId: string | null;
  eventType: 'applied' | 'dismissed';
}

export function FeedbackReasonModal({ open, onClose, feedbackId, eventType }: FeedbackReasonModalProps) {
  const { user } = useAuth();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [saving, setSaving] = useState(false);

  const reasons = eventType === 'applied' ? APPLIED_REASONS : DISMISSED_REASONS;

  const handleSubmit = async () => {
    if (!feedbackId || !selectedCode || !user?.id) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await (supabase.from('ai_dispatch_feedback_reasons') as any).insert([{
        feedback_id: feedbackId,
        reason_code: selectedCode,
        reason_text: reasonText || null,
        created_by: user.id,
      }]);
    } catch {
      // Silent failure — telemetry only
      console.debug('[Phase5B] Failed to record feedback reason (non-blocking)');
    }
    setSaving(false);
    setSelectedCode(null);
    setReasonText('');
    onClose();
  };

  const handleSkip = () => {
    setSelectedCode(null);
    setReasonText('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {eventType === 'applied' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            {eventType === 'applied' ? 'Why did you accept?' : 'Why did you dismiss?'}
          </DialogTitle>
          <DialogDescription>
            Optional — helps improve future suggestions
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {reasons.map(r => (
            <Badge
              key={r.code}
              variant={selectedCode === r.code ? 'default' : 'outline'}
              className="cursor-pointer text-sm px-3 py-1.5 transition-colors"
              onClick={() => setSelectedCode(selectedCode === r.code ? null : r.code)}
            >
              {r.label}
            </Badge>
          ))}
        </div>

        <Textarea
          placeholder="Any additional context? (optional)"
          value={reasonText}
          onChange={e => setReasonText(e.target.value)}
          className="min-h-[60px]"
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !selectedCode}>
            {saving ? 'Saving...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
