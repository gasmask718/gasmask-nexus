// Floor 9 - Structured Feedback Capture Modal
// Phase 9.2.1 - Learning Feedback Loop

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  ThumbsUp,
  ThumbsDown,
  Edit,
  AlertTriangle,
  Lightbulb,
  Shield,
} from 'lucide-react';
import { 
  useSubmitFeedback, 
  FeedbackCategory, 
  FeedbackDecisionType,
  SubmitFeedbackParams,
} from '@/hooks/useLearningFeedback';

interface FeedbackCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Context about what's being reviewed
  decisionType: FeedbackDecisionType;
  taskId?: string;
  actionQueueId?: string;
  workerId?: string;
  playbookId?: string;
  taskType?: string;
  targetEntityType?: string;
  confidenceScore?: number;
  originalRecommendation?: string;
  // Callback after submission
  onFeedbackSubmitted?: () => void;
}

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: 'accuracy', label: 'Accuracy Issue', description: 'The recommendation was factually incorrect' },
  { value: 'timing', label: 'Bad Timing', description: 'Right action, wrong time' },
  { value: 'context_missing', label: 'Missing Context', description: 'AI lacked important information' },
  { value: 'wrong_target', label: 'Wrong Target', description: 'Directed at wrong entity/person' },
  { value: 'tone_inappropriate', label: 'Tone Problem', description: 'Communication style was wrong' },
  { value: 'data_stale', label: 'Stale Data', description: 'Based on outdated information' },
  { value: 'permission_issue', label: 'Permission Issue', description: 'Action requires higher authority' },
  { value: 'ambiguous_instructions', label: 'Ambiguous Instructions', description: 'Task instructions were unclear' },
  { value: 'other', label: 'Other', description: 'Reason not listed above' },
];

const DECISION_CONFIG: Record<FeedbackDecisionType, { icon: React.ReactNode; color: string; label: string }> = {
  approved: { icon: <ThumbsUp className="h-4 w-4" />, color: 'text-green-600', label: 'Approval' },
  rejected: { icon: <ThumbsDown className="h-4 w-4" />, color: 'text-red-600', label: 'Rejection' },
  modified: { icon: <Edit className="h-4 w-4" />, color: 'text-yellow-600', label: 'Modification' },
  rolled_back: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-purple-600', label: 'Rollback' },
  escalated: { icon: <Shield className="h-4 w-4" />, color: 'text-orange-600', label: 'Escalation' },
};

export function FeedbackCaptureModal({
  open,
  onOpenChange,
  decisionType,
  taskId,
  actionQueueId,
  workerId,
  playbookId,
  taskType,
  targetEntityType,
  confidenceScore,
  originalRecommendation,
  onFeedbackSubmitted,
}: FeedbackCaptureModalProps) {
  const submitFeedback = useSubmitFeedback();
  
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('accuracy');
  const [feedbackReasoning, setFeedbackReasoning] = useState('');
  const [modifiedTo, setModifiedTo] = useState('');
  const [whatChanged, setWhatChanged] = useState('');
  const [whyChanged, setWhyChanged] = useState('');
  const [wasOverconfident, setWasOverconfident] = useState(false);
  const [wasUnderconfident, setWasUnderconfident] = useState(false);
  const [shouldRetrainOn, setShouldRetrainOn] = useState(false);
  const [suggestedRuleChange, setSuggestedRuleChange] = useState('');

  const decisionInfo = DECISION_CONFIG[decisionType];
  const isModification = decisionType === 'modified';
  const isRejection = decisionType === 'rejected';
  const isApproval = decisionType === 'approved';

  const isValid = feedbackReasoning.trim().length >= 10 && 
    (!isModification || (whatChanged.trim().length > 0 && whyChanged.trim().length > 0));

  const handleSubmit = () => {
    const params: SubmitFeedbackParams = {
      taskId,
      actionQueueId,
      workerId,
      playbookId,
      decisionType,
      confidenceAtDecision: confidenceScore,
      taskType,
      targetEntityType,
      feedbackCategory,
      feedbackReasoning: feedbackReasoning.trim(),
      originalRecommendation,
      modifiedTo: isModification ? modifiedTo : undefined,
      whatChanged: isModification ? whatChanged : undefined,
      whyChanged: isModification ? whyChanged : undefined,
      wasOverconfident,
      wasUnderconfident,
      shouldRetrainOn,
      suggestedRuleChange: suggestedRuleChange.trim() || undefined,
    };

    submitFeedback.mutate(params, {
      onSuccess: () => {
        // Reset form
        setFeedbackCategory('accuracy');
        setFeedbackReasoning('');
        setModifiedTo('');
        setWhatChanged('');
        setWhyChanged('');
        setWasOverconfident(false);
        setWasUnderconfident(false);
        setShouldRetrainOn(false);
        setSuggestedRuleChange('');
        
        onOpenChange(false);
        onFeedbackSubmitted?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Learning Feedback
          </DialogTitle>
          <DialogDescription>
            Help improve AI accuracy by providing structured feedback on this {decisionInfo.label.toLowerCase()}.
            This data trains future recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Decision Context */}
          <Card className="bg-muted/50">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={decisionInfo.color}>{decisionInfo.icon}</span>
                <span className="font-medium">{decisionInfo.label}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {taskType && <Badge variant="outline">{taskType}</Badge>}
                {confidenceScore != null && (
                  <span className="flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    {confidenceScore}% confidence
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Feedback Category */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {isApproval ? 'Why was this approved?' : isRejection ? 'Primary reason for rejection' : 'Why was this modified?'}
            </Label>
            <RadioGroup
              value={feedbackCategory}
              onValueChange={(v) => setFeedbackCategory(v as FeedbackCategory)}
              className="grid grid-cols-1 md:grid-cols-2 gap-2"
            >
              {FEEDBACK_CATEGORIES.map((cat) => (
                <div key={cat.value} className="flex items-start space-x-2">
                  <RadioGroupItem value={cat.value} id={cat.value} className="mt-1" />
                  <Label htmlFor={cat.value} className="font-normal cursor-pointer">
                    <span className="font-medium">{cat.label}</span>
                    <span className="block text-xs text-muted-foreground">{cat.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Detailed Reasoning (Required) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Detailed Explanation <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Explain in detail why you made this decision. This feedback directly improves AI accuracy..."
              value={feedbackReasoning}
              onChange={(e) => setFeedbackReasoning(e.target.value)}
              rows={3}
              className={feedbackReasoning.length > 0 && feedbackReasoning.length < 10 ? 'border-red-500' : ''}
            />
            {feedbackReasoning.length > 0 && feedbackReasoning.length < 10 && (
              <p className="text-xs text-red-500">Minimum 10 characters required</p>
            )}
          </div>

          {/* Modification-Specific Fields */}
          {isModification && (
            <>
              <Separator />
              <div className="space-y-4 p-4 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                <h4 className="font-medium flex items-center gap-2">
                  <Edit className="h-4 w-4 text-yellow-600" />
                  Modification Details
                </h4>
                
                <div className="space-y-2">
                  <Label className="text-sm">What changed? <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder="Describe specifically what you changed from the original recommendation..."
                    value={whatChanged}
                    onChange={(e) => setWhatChanged(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Why did you change it? <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder="Explain your reasoning for making these changes..."
                    value={whyChanged}
                    onChange={(e) => setWhyChanged(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Modified recommendation (optional)</Label>
                  <Textarea
                    placeholder="The final recommendation after your modifications..."
                    value={modifiedTo}
                    onChange={(e) => setModifiedTo(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}

          {/* Confidence Signals */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Confidence Calibration Signals</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overconfident"
                  checked={wasOverconfident}
                  onCheckedChange={(checked) => setWasOverconfident(checked === true)}
                />
                <Label htmlFor="overconfident" className="font-normal cursor-pointer">
                  AI was <span className="font-medium text-orange-600">overconfident</span> — high confidence but wrong
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="underconfident"
                  checked={wasUnderconfident}
                  onCheckedChange={(checked) => setWasUnderconfident(checked === true)}
                />
                <Label htmlFor="underconfident" className="font-normal cursor-pointer">
                  AI was <span className="font-medium text-blue-600">underconfident</span> — low confidence but correct
                </Label>
              </div>
            </div>
          </div>

          {/* Learning Signals */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Learning Signals (Optional)
            </Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="retrain"
                checked={shouldRetrainOn}
                onCheckedChange={(checked) => setShouldRetrainOn(checked === true)}
              />
              <Label htmlFor="retrain" className="font-normal cursor-pointer">
                Flag this as a <span className="font-medium">training example</span> for future AI improvement
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Suggest a rule change (optional)</Label>
              <Textarea
                placeholder="If you think a playbook rule should be adjusted, describe the change here..."
                value={suggestedRuleChange}
                onChange={(e) => setSuggestedRuleChange(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isValid || submitFeedback.isPending}
          >
            {submitFeedback.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>

        {/* Immutable Notice */}
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="h-3 w-3" />
          This feedback is permanently recorded and cannot be deleted.
        </div>
      </DialogContent>
    </Dialog>
  );
}
