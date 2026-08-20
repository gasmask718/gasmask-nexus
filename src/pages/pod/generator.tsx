import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SignedImage } from '@/components/ui/signed-image';

export default function PODGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [category, setCategory] = useState<string>("evergreen");
  const [prompt, setPrompt] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [lastResult, setLastResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the design first");
      return;
    }
    setIsGenerating(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("pod-generate-design", {
        body: { prompt, category, title: title || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setLastResult(data);
      toast.success(`Design created — ${data.listings?.length || 0} draft listings spawned`);
      setPrompt("");
      setTitle("");
    } catch (e: any) {
      console.error("POD generate error:", e);
      toast.error(e.message || "Failed to generate design");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">POD Design Factory</h1>
        <p className="text-muted-foreground">
          Real AI image generation via Lovable AI Gateway (Gemini 2.5 Flash Image) → uploads to <code>pod-designs</code> bucket → fans out draft listings per channel.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            New Design
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <Textarea
              placeholder="e.g. retro 80s gas mask with neon palm trees, vaporwave style"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evergreen">Evergreen</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="hot_mama">Hot Mama</SelectItem>
                  <SelectItem value="gasmask">GasMask</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="auto from prompt" />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
            ) : (
              <><Zap className="mr-2 h-5 w-5" /> Generate Design</>
            )}
          </Button>
        </CardContent>
      </Card>

      {lastResult?.design && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lastResult.design.design_image_url && (
              <SignedImage bucket="pod-designs" path={lastResult.design.design_image_url}
                           alt={lastResult.design.title}
                           className="w-full max-w-sm rounded-lg border" />
            )}
            <div className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Design ID:</span> <code>{lastResult.design.id}</code></div>
              <div><span className="text-muted-foreground">Title:</span> {lastResult.design.title}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Listings:</span>
                {lastResult.listings?.map((l: any) => (
                  <Badge key={l.id} variant={l.status === 'draft' ? 'default' : 'outline'}>
                    {l.channel} · {l.status}
                  </Badge>
                ))}
              </div>
              <a href="/pod/designs" className="inline-flex items-center gap-1 text-primary text-sm mt-2">
                View in library <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
