import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useStateCompliance, SupportedState, STATE_LABELS } from '@/hooks/useStateCompliance';

interface StateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StateSelector({ open, onOpenChange }: StateSelectorProps) {
  const { currentState, updateUserState, isUpdatingState, currentStateRules } = useStateCompliance();
  const [selectedState, setSelectedState] = useState<SupportedState>(currentState);

  const handleSave = () => {
    updateUserState(selectedState);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Your State
          </DialogTitle>
          <DialogDescription>
            Your state determines which platforms and entry formats are available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedState} onValueChange={(v) => setSelectedState(v as SupportedState)}>
            {(['NY', 'GA', 'CA'] as SupportedState[]).map((state) => (
              <div key={state} className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={state} id={state} />
                <Label htmlFor={state} className="flex-1 cursor-pointer">
                  <span className="font-medium">{STATE_LABELS[state]}</span>
                  <span className="ml-2 text-muted-foreground">({state})</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Compliance Note
            </div>
            <p className="text-xs text-muted-foreground">
              No VPN or location bypass is supported. Platform access is determined by your selected state.
            </p>
          </div>

          {currentStateRules?.tooltip_text && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {currentStateRules.tooltip_text}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdatingState}>
            {isUpdatingState ? 'Saving...' : 'Save State'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StateBadge() {
  const [open, setOpen] = useState(false);
  const { currentState, isLoading } = useStateCompliance();

  if (isLoading) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-medium"
      >
        <MapPin className="h-3 w-3" />
        <span>State: {currentState}</span>
      </button>
      <StateSelector open={open} onOpenChange={setOpen} />
    </>
  );
}
