import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly", desc: "Warm and conversational" },
  { value: "professional", label: "Professional", desc: "Formal and business-like" },
  { value: "arabic", label: "Arabic Cultural", desc: "Salam, Alhamdulillah, Inshallah" },
  { value: "urgent", label: "Urgent", desc: "Time-sensitive offer" },
  { value: "promotional", label: "Promotional", desc: "Product announcement" },
];

const PRODUCT_OPTIONS = [
  "GasMask Bags", "GasMask Tubes", "HotMama", "Grabba R Us",
  "Hotscolatti Light", "Hotscolatti Dark", "Hotscolatti Bros", "Full product line",
];

const QUICK_PROMPTS = [
  "Announce new Hotscolatti Bros at $1 per unit",
  "Follow up with stores that haven't ordered in 30 days",
  "Promote our full grabba line to new prospects",
  "Remind active customers to reorder",
  "Introduce Dynasty to new leads",
  "Thank top customers for their business",
];

interface AIMessageComposerProps {
  audience: Array<Record<string, any>>;
  audienceType: string;
  onMessageGenerated: (message: string) => void;
}

export function AIMessageComposer({ audience, audienceType, onMessageGenerated }: AIMessageComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("friendly");
  const [product, setProduct] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [showComposer, setShowComposer] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Tell the AI what message to write");
      return;
    }
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-message-composer", {
        body: {
          prompt,
          tone,
          product: product || null,
          audience_type: audienceType,
          audience_count: audience.length,
          language_mix: {
            arabic: audience.filter(c => c.language_detected === "arabic").length,
            spanish: audience.filter(c => c.language_detected === "spanish").length,
            english: audience.filter(c => !c.language_detected || c.language_detected === "english").length,
          },
        },
      });

      if (error) throw error;
      setGeneratedMessage(data.message);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate message");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowComposer(!showComposer)}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {showComposer ? "Hide AI Composer" : "Use AI to write your message"}
      </button>

      {showComposer && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">AI Message Composer</p>
            </div>

            {/* Quick prompts */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium">Quick ideas:</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => setPrompt(qp)}
                    className="text-[10px] px-2 py-1 rounded-full bg-background border border-border hover:border-primary/40 transition-colors"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <Label className="text-xs">What should the message say?</Label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="e.g. Tell them about our new Hotscolatti Bros product at $1"
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Tone + Product */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Tone</Label>
                <div className="grid grid-cols-1 gap-1">
                  {TONE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={`text-left px-2 py-1.5 rounded-md border text-xs transition-all ${
                        tone === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">— {t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-1">Feature a product (optional)</Label>
                <div className="grid grid-cols-1 gap-1">
                  {PRODUCT_OPTIONS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProduct(product === p ? "" : p)}
                      className={`text-left px-2 py-1 rounded-md border text-xs transition-all ${
                        product === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Audience context */}
            <div className="bg-background rounded-lg p-2 text-[10px] text-muted-foreground">
              Sending to <strong>{audience.length}</strong> {audienceType} contacts ·{" "}
              {audience.filter(c => c.language_detected === "arabic").length} Arabic ·{" "}
              {audience.filter(c => c.language_detected === "spanish").length} Spanish ·{" "}
              {audience.filter(c => !c.language_detected || c.language_detected === "english").length} English
            </div>

            <Button
              onClick={generate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full gap-2"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Generate Message
                </>
              )}
            </Button>

            {/* Generated result */}
            {generatedMessage && (
              <div className="space-y-2">
                <div className="bg-background rounded-lg p-3 border text-xs leading-relaxed whitespace-pre-wrap">
                  {generatedMessage}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => {
                      onMessageGenerated(generatedMessage);
                      setShowComposer(false);
                      toast.success("Message applied");
                    }}
                  >
                    <Check className="w-3 h-3" /> Use This Message
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={generate}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
