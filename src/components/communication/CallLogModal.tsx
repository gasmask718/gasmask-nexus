import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CallLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  entityName: string;
}

export function CallLogModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: CallLogModalProps) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [phone, setPhone] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("completed");
  const [notes, setNotes] = useState("");

  const logCallMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("communication_events").insert({
        linked_entity_type: entityType,
        linked_entity_id: entityId,
        channel: "call",
        direction: direction,
        event_type: `call_${outcome}`,
        summary: `${direction === "inbound" ? "Incoming" : "Outgoing"} call - ${outcome}${
          duration ? ` (${duration} min)` : ""
        }`,
        external_contact: phone || null,
        user_id: user.id,
        payload: {
          duration_minutes: duration ? parseFloat(duration) : 0,
          outcome,
          notes,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Call logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      queryClient.invalidateQueries({ queryKey: ["communication-stats"] });
      onOpenChange(false);
      // Reset form
      setPhone("");
      setDuration("");
      setOutcome("completed");
      setNotes("");
    },
    onError: (error) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    logCallMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Call - {entityName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Call Type</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">Outgoing Call</SelectItem>
                <SelectItem value="inbound">Incoming Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Phone Number (Optional)</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="5"
            />
          </div>

          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_answer">No Answer</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="follow_up_needed">Follow-up Needed</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call summary and next steps..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={logCallMutation.isPending}>
              {logCallMutation.isPending ? "Logging..." : "Log Call"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}