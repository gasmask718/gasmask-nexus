import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { useClientPortal } from "./ClientPortalPage";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayHours = { open: string; close: string; closed: boolean };
type Faq = { question: string; answer: string };

const normalizeHours = (raw: any): Record<string, DayHours> => {
  const out: Record<string, DayHours> = {};
  for (const d of DAYS) {
    const v = raw?.[d] ?? {};
    out[d] = {
      open: typeof v.open === "string" ? v.open : "09:00",
      close: typeof v.close === "string" ? v.close : "17:00",
      closed: v.closed === true || v.open === "closed",
    };
  }
  return out;
};

const normalizeFaqs = (raw: any): Faq[] =>
  Array.isArray(raw)
    ? raw.map((f) => ({ question: String(f?.question ?? ""), answer: String(f?.answer ?? "") }))
    : [];

export default function ClientSettings() {
  const { client, refresh } = useClientPortal();
  const [name, setName] = useState(client.receptionist_name ?? "");
  const [hours, setHours] = useState<Record<string, DayHours>>(normalizeHours(client.business_hours));
  const [faqs, setFaqs] = useState<Faq[]>(normalizeFaqs(client.faqs));
  const [calendarUrl, setCalendarUrl] = useState(client.appointment_calendar_url ?? "");
  const [escalation, setEscalation] = useState(client.escalation_phone ?? "");
  const [saving, setSaving] = useState(false);

  const setDay = (day: string, patch: Partial<DayHours>) =>
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));

  const save = async () => {
    if (!name.trim()) {
      toast.error("Receptionist name is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-client-update-config", {
        body: {
          receptionist_name: name.trim(),
          business_hours: hours,
          faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
          appointment_calendar_url: calendarUrl.trim() || null,
          escalation_phone: escalation.trim() || null,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      await refresh();
      toast.success(
        (data as any)?.agent_updated
          ? "Settings saved and pushed to your receptionist"
          : "Settings saved (agent update pending)"
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed", { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Settings</h2>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Receptionist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="recname">Receptionist name</Label>
            <Input id="recname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="esc">Escalation phone</Label>
            <Input
              id="esc"
              value={escalation}
              placeholder="+15551234567"
              onChange={(e) => setEscalation(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="cal">Appointment calendar URL</Label>
            <Input
              id="cal"
              value={calendarUrl}
              placeholder="https://calendly.com/your-business"
              onChange={(e) => setCalendarUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Business hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map((d) => (
            <div key={d} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-sm capitalize">{d}</span>
              <Switch
                checked={!hours[d].closed}
                onCheckedChange={(v) => setDay(d, { closed: !v })}
                aria-label={`${d} open`}
              />
              {hours[d].closed ? (
                <span className="text-sm text-muted-foreground">Closed</span>
              ) : (
                <>
                  <Input
                    type="time"
                    className="w-32"
                    value={hours[d].open}
                    onChange={(e) => setDay(d, { open: e.target.value })}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={hours[d].close}
                    onChange={(e) => setDay(d, { close: e.target.value })}
                  />
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">FAQs</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFaqs((f) => [...f, { question: "", answer: "" }])}
          >
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!faqs.length && (
            <p className="text-sm text-muted-foreground">
              No FAQs yet — add the questions callers ask most.
            </p>
          )}
          {faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Question"
                  value={f.question}
                  onChange={(e) =>
                    setFaqs((prev) => prev.map((p, j) => (j === i ? { ...p, question: e.target.value } : p)))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFaqs((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Delete FAQ"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                placeholder="Answer"
                rows={2}
                value={f.answer}
                onChange={(e) =>
                  setFaqs((prev) => prev.map((p, j) => (j === i ? { ...p, answer: e.target.value } : p)))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
