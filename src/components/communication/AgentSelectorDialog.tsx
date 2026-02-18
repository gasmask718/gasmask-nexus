import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import type { AIAgent } from "@/hooks/useAIAgents";

interface AgentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
  storePhone: string | null;
  agents: AIAgent[];
  onConfirm: (agent: AIAgent) => void;
}

export function AgentSelectorDialog({
  open,
  onOpenChange,
  storeName,
  storePhone,
  agents,
  onConfirm,
}: AgentSelectorDialogProps) {
  const [selectedId, setSelectedId] = useState<string>(agents[0]?.id ?? "");

  const activeAgents = agents.filter((a) => a.active);

  const handleConfirm = () => {
    const agent = activeAgents.find((a) => a.id === selectedId);
    if (agent) onConfirm(agent);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Select Agent for Call
          </DialogTitle>
          <DialogDescription>
            Store: <strong>{storeName}</strong>
            {storePhone && <span className="ml-2">({storePhone})</span>}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selectedId} onValueChange={setSelectedId} className="space-y-3 py-4">
          {activeAgents.map((agent) => (
            <div key={agent.id} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value={agent.id} id={agent.id} />
              <Label htmlFor={agent.id} className="flex-1 cursor-pointer">
                <span className="font-medium">{agent.name}</span>
                {agent.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {!storePhone && (
          <p className="text-sm text-destructive">
            ⚠ This store has no phone number on file. A Twilio call cannot be placed.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || !storePhone}>
            <Phone className="h-4 w-4 mr-1" />
            Start Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
