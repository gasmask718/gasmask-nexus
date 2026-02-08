/**
 * Sell-Through Feedback Capture — Phase VI-B
 * 
 * Minimal, unobtrusive feedback input at the bottom of the
 * Ambassador Sell-Through page.
 * 
 * - Optional, not nagging
 * - Max 280 characters
 * - Manual submit only
 * - No modal, no interrupt
 */

import { useState } from "react";
import { MessageSquare, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  ambassadorId: string | null | undefined;
}

export function SellThroughFeedback({ ambassadorId }: Props) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!ambassadorId || !text.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("sell_through_feedback")
        .insert({
          ambassador_id: ambassadorId,
          text: text.trim(),
          page_context: "ambassador_sell_through",
        });

      if (error) throw error;

      setSubmitted(true);
      setText("");
      toast.success("Thanks for your feedback!");

      // Reset after 10s so they can submit again if needed
      setTimeout(() => setSubmitted(false), 10000);
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ambassadorId) return null;

  return (
    <div className="border-t border-border pt-6 mt-8">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          What question do you still wish this answered?
        </p>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4" />
          <span>Feedback received — thank you!</span>
        </div>
      ) : (
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            placeholder="e.g. I'd like to see order trends over time for my top stores…"
            className="min-h-[60px] max-h-[100px] text-sm resize-none flex-1"
            maxLength={280}
          />
          <div className="flex flex-col items-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="h-8"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Send
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {text.length}/280
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
