import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Mail, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: string;
  defaultEntityId?: string;
}

export function SendMessageModal({
  open,
  onOpenChange,
  defaultEntityType,
  defaultEntityId,
}: SendMessageModalProps) {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState(defaultEntityType || "store");
  const [entityId, setEntityId] = useState(defaultEntityId || "");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [message, setMessage] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);

  // Fetch entities based on type
  const { data: entities } = useQuery({
    queryKey: ["entities", entityType],
    queryFn: async () => {
      if (entityType === "store") {
        const { data } = await supabase.from("stores").select("id, name").order("name");
        return data;
      } else if (entityType === "customer") {
        const { data } = await supabase.from("crm_customers").select("id, name").order("name");
        return data;
      } else if (entityType === "wholesale") {
        const { data } = await supabase.from("wholesale_hubs").select("id, name").order("name");
        return data;
      } else if (entityType === "driver") {
        const { data } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("role", "driver")
          .order("name");
        return data;
      } else if (entityType === "influencer") {
        const { data } = await supabase
          .from("influencers")
          .select("id, name")
          .order("name");
        return data;
      }
      return [];
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // In mock mode, just log the communication
      const { error } = await supabase.from("communication_events").insert({
        linked_entity_type: entityType,
        linked_entity_id: entityId,
        channel: channel,
        direction: "outbound",
        event_type: channel, // Use 'sms' or 'email' directly (matches constraint)
        summary: message.substring(0, 100),
        user_id: user.id,
      });

      if (error) throw error;

      // Simulate success/failure (95% success rate)
      const success = Math.random() > 0.05;
      if (!success) throw new Error("Message delivery failed (mock)");
    },
    onSuccess: () => {
      toast.success("Message sent successfully!");
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      queryClient.invalidateQueries({ queryKey: ["communication-stats"] });
      onOpenChange(false);
      setMessage("");
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  const generateAIMessage = async () => {
    if (!entityId) {
      toast.error("Please select an entity first");
      return;
    }

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-message", {
        body: {
          entity_type: entityType,
          entity_id: entityId,
          message_purpose: "follow-up",
          tone_style: "friendly",
          context: "",
        },
      });

      if (error) throw error;
      setMessage(data.message);
      toast.success("AI message generated!");
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate AI message");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    sendMessageMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="store">Store</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="wholesale">Wholesale Hub</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select {entityType}</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose a ${entityType}`} />
              </SelectTrigger>
              <SelectContent>
                {entities?.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={channel === "sms" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setChannel("sms")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
              <Button
                type="button"
                variant={channel === "email" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setChannel("email")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateAIMessage}
                disabled={generatingAI || !entityId}
              >
                {generatingAI ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                AI Generate
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                channel === "sms"
                  ? "Keep it short for SMS (160 chars)"
                  : "Write your message..."
              }
              rows={channel === "sms" ? 3 : 5}
              maxLength={channel === "sms" ? 160 : undefined}
            />
            {channel === "sms" && (
              <p className="text-xs text-muted-foreground">
                {message.length}/160 characters
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sendMessageMutation.isPending}>
              {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}