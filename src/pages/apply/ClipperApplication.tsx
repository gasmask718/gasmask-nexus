import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X / Twitter" },
] as const;

const RANGES = ["0-1k", "1k-10k", "10k-50k", "50k-250k", "250k-1M", "1M+"];

type PlatformKey = (typeof PLATFORMS)[number]["key"];

export default function ClipperApplication() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [ranges, setRanges] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Apply to Clipper Nation | Get Paid to Clip";
    const desc = "Apply to join Clipper Nation. Submit your socials and follower reach to get paid for short-form clips.";
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", desc);
  }, []);

  const setSocial = (k: PlatformKey, v: string) => setSocials((s) => ({ ...s, [k]: v }));
  const setRange = (k: PlatformKey, v: string) => setRanges((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = fullName.trim();
    const mail = email.trim().toLowerCase();
    if (!name || name.length > 120) return toast.error("Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return toast.error("Please enter a valid email address.");
    if (whyJoin.length > 2000) return toast.error("Please keep your answer under 2000 characters.");

    const cleanSocials = Object.fromEntries(
      Object.entries(socials).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 120)])
    );
    if (Object.keys(cleanSocials).length === 0) {
      return toast.error("Add at least one social handle.");
    }
    const cleanRanges = Object.fromEntries(
      Object.entries(ranges).filter(([k, v]) => v && cleanSocials[k])
    );

    setSubmitting(true);
    const { data, error } = await supabase
      .from("clipper_applications")
      .insert({
        full_name: name,
        email: mail,
        phone: phone.trim().slice(0, 40) || null,
        socials: cleanSocials,
        follower_ranges: cleanRanges,
        why_join: whyJoin.trim() || null,
      })
      .select("id")
      .single();
    setSubmitting(false);

    if (error) {
      toast.error(`Could not submit application: ${error.message}`);
      return;
    }
    setRefId(data?.id ?? null);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <Card className="max-w-lg w-full text-center">
          <CardHeader>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <CardTitle className="text-2xl">Application received</CardTitle>
            <CardDescription>
              Thanks {fullName.split(" ")[0]} — your Clipper Nation application is in the review queue.
              We'll email {email} once it's reviewed.
            </CardDescription>
          </CardHeader>
          {refId && (
            <CardContent>
              <p className="text-xs text-muted-foreground font-mono">Reference: {refId}</p>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <Film className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Apply to Clipper Nation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Get paid to clip. Tell us where you post and how big your reach is.
          </p>
        </header>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name *</Label>
                  <Input id="full_name" value={fullName} maxLength={120} required
                    onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} maxLength={255} required
                    onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} maxLength={40}
                  onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>

              <div className="space-y-3">
                <Label>Socials & reach *</Label>
                {PLATFORMS.map((p) => (
                  <div key={p.key} className="grid gap-2 sm:grid-cols-[1fr_180px] items-center">
                    <Input
                      value={socials[p.key] || ""}
                      maxLength={120}
                      onChange={(e) => setSocial(p.key, e.target.value)}
                      placeholder={`${p.label} handle (@username)`}
                    />
                    <Select value={ranges[p.key] || ""} onValueChange={(v) => setRange(p.key, v)}>
                      <SelectTrigger aria-label={`${p.label} followers`}>
                        <SelectValue placeholder="Followers" />
                      </SelectTrigger>
                      <SelectContent>
                        {RANGES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">At least one handle is required.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="why">Why do you want to join?</Label>
                <Textarea id="why" value={whyJoin} maxLength={2000} rows={5}
                  onChange={(e) => setWhyJoin(e.target.value)}
                  placeholder="Tell us about the content you make and what you're aiming for." />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? "Submitting..." : "Submit application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
