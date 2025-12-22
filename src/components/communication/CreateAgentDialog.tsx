import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/contexts/BusinessContext";
import { toast } from "sonner";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const agentRoles = [
  { value: "sales", label: "Sales Agent" },
  { value: "support", label: "Support Agent" },
  { value: "supervisor", label: "Supervisor" },
  { value: "scheduler", label: "Scheduler" },
  { value: "analyst", label: "Analyst" },
];

export function CreateAgentDialog({ open, onOpenChange }: CreateAgentDialogProps) {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      if (!currentBusiness?.id) throw new Error("No business selected");
      
      const { data, error } = await supabase
        .from("ai_agents")
        .insert({
          name,
          role,
          description,
          business_id: currentBusiness.id,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Agent created successfully");
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create agent: " + error.message);
    },
  });

  const resetForm = () => {
    setName("");
    setRole("");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) {
      toast.error("Please fill in all required fields");
      return;
    }
    createAgentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New AI Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter agent name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {agentRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the agent's purpose..."
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAgentMutation.isPending}>
              {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
