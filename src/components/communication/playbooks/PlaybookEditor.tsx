import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { SalesPlaybook } from '@/hooks/usePlaybooks';

interface PlaybookEditorProps {
  playbook?: SalesPlaybook | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<SalesPlaybook>) => void;
  businessId: string;
}

export function PlaybookEditor({
  playbook,
  open,
  onClose,
  onSave,
  businessId,
}: PlaybookEditorProps) {
  const [name, setName] = useState(playbook?.name ?? '');
  const [description, setDescription] = useState(playbook?.description ?? '');
  const [targetIntents, setTargetIntents] = useState<string[]>(playbook?.target_intents ?? []);
  const [allowedTactics, setAllowedTactics] = useState<string[]>(playbook?.allowed_tactics ?? []);
  const [forbiddenTactics, setForbiddenTactics] = useState<string[]>(playbook?.forbidden_tactics ?? []);
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>(playbook?.escalation_triggers ?? []);
  const [maxDuration, setMaxDuration] = useState(playbook?.max_duration_seconds ?? 300);
  // Convert from decimal (0.75) to percentage (75) for UI display
  const [confidenceFloor, setConfidenceFloor] = useState(
    playbook?.confidence_floor 
      ? (playbook.confidence_floor < 1 ? Math.round(playbook.confidence_floor * 100) : playbook.confidence_floor)
      : 75
  );
  
  const [newIntent, setNewIntent] = useState('');
  const [newAllowed, setNewAllowed] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [newEscalation, setNewEscalation] = useState('');

  const addToList = (
    value: string,
    setValue: (v: string) => void,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()]);
      setValue('');
    }
  };

  const removeFromList = (item: string, list: string[], setList: (l: string[]) => void) => {
    setList(list.filter((i) => i !== item));
  };

  const handleSave = () => {
    // Convert percentage to decimal for DB (UI shows 75%, DB expects 0.75)
    const confidenceFloorDecimal = confidenceFloor / 100;
    
    onSave({
      business_id: businessId,
      name,
      description: description || null,
      target_intents: targetIntents,
      allowed_tactics: allowedTactics,
      forbidden_tactics: forbiddenTactics,
      escalation_triggers: escalationTriggers,
      max_duration_seconds: maxDuration,
      confidence_floor: confidenceFloorDecimal,
      // DB requires structure column (NOT NULL with default '[]'::jsonb)
      structure: [],
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {playbook ? 'Edit Playbook' : 'Create Playbook'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Inbound Sales Inquiry"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this playbook for?"
                rows={2}
              />
            </div>
          </div>

          {/* Target Intents */}
          <div>
            <Label>Target Intents</Label>
            <p className="text-xs text-muted-foreground mb-2">
              What caller intents should trigger this playbook?
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={newIntent}
                onChange={(e) => setNewIntent(e.target.value)}
                placeholder="e.g., pricing_inquiry"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newIntent, setNewIntent, targetIntents, setTargetIntents);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newIntent, setNewIntent, targetIntents, setTargetIntents)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {targetIntents.map((intent) => (
                <Badge key={intent} variant="secondary" className="gap-1">
                  {intent}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(intent, targetIntents, setTargetIntents)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Allowed Tactics */}
          <div>
            <Label className="text-green-600">Allowed Tactics</Label>
            <p className="text-xs text-muted-foreground mb-2">
              What techniques may the AI use?
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={newAllowed}
                onChange={(e) => setNewAllowed(e.target.value)}
                placeholder="e.g., build_rapport"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newAllowed, setNewAllowed, allowedTactics, setAllowedTactics);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newAllowed, setNewAllowed, allowedTactics, setAllowedTactics)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {allowedTactics.map((tactic) => (
                <Badge key={tactic} className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                  {tactic}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(tactic, allowedTactics, setAllowedTactics)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Forbidden Tactics */}
          <div>
            <Label className="text-red-600">Forbidden Tactics</Label>
            <p className="text-xs text-muted-foreground mb-2">
              What techniques must the AI never use?
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={newForbidden}
                onChange={(e) => setNewForbidden(e.target.value)}
                placeholder="e.g., pressure_close"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newForbidden, setNewForbidden, forbiddenTactics, setForbiddenTactics);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newForbidden, setNewForbidden, forbiddenTactics, setForbiddenTactics)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {forbiddenTactics.map((tactic) => (
                <Badge key={tactic} className="gap-1 bg-red-500/10 text-red-600 border-red-500/20">
                  {tactic}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(tactic, forbiddenTactics, setForbiddenTactics)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Escalation Triggers */}
          <div>
            <Label>Escalation Triggers</Label>
            <p className="text-xs text-muted-foreground mb-2">
              When should AI hand off to a human?
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={newEscalation}
                onChange={(e) => setNewEscalation(e.target.value)}
                placeholder="e.g., angry_caller"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newEscalation, setNewEscalation, escalationTriggers, setEscalationTriggers);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newEscalation, setNewEscalation, escalationTriggers, setEscalationTriggers)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {escalationTriggers.map((trigger) => (
                <Badge key={trigger} variant="outline" className="gap-1">
                  {trigger}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(trigger, escalationTriggers, setEscalationTriggers)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label>Max Duration: {Math.floor(maxDuration / 60)}m {maxDuration % 60}s</Label>
              <Slider
                value={[maxDuration]}
                onValueChange={([v]) => setMaxDuration(v)}
                min={60}
                max={900}
                step={30}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Confidence Floor: {confidenceFloor}%</Label>
              <Slider
                value={[confidenceFloor]}
                onValueChange={([v]) => setConfidenceFloor(v)}
                min={50}
                max={95}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {playbook ? 'Save Changes' : 'Create Playbook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
