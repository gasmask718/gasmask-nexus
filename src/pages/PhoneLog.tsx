import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Phone, MessageSquare, Voicemail, Mic, Store, Loader2 } from "lucide-react";
import { usePhoneLog, prettyPhone, last10 } from "@/hooks/usePhoneLog";
import { PhoneLogTimeline } from "@/components/phone/PhoneLogTimeline";
import { VoiceRoutingSettingsCard } from "@/components/phone/VoiceRoutingSettingsCard";

/**
 * PhoneLog — one inbox for every call, text, recording and voicemail,
 * threaded by phone number.
 */
export default function PhoneLog() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const selected = params.get("number");

  const { data: threads, isLoading } = usePhoneLog({ limit: 1000 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads || [];
    return (threads || []).filter(
      (t) =>
        t.number.includes(q.replace(/\D/g, "")) ||
        (t.storeName || "").toLowerCase().includes(q) ||
        t.lastPreview.toLowerCase().includes(q),
    );
  }, [threads, search]);

  const active = (threads || []).find((t) => t.number === last10(selected)) || null;

  const totals = useMemo(() => {
    const t = threads || [];
    return {
      calls: t.reduce((s, x) => s + x.callCount, 0),
      texts: t.reduce((s, x) => s + x.smsCount, 0),
      recordings: t.reduce((s, x) => s + x.recordingCount, 0),
      voicemails: t.reduce((s, x) => s + x.voicemailCount, 0),
    };
  }, [threads]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Phone Log</h1>
        <p className="text-sm text-muted-foreground">
          Every call, text, recording and voicemail — grouped by number.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Calls", value: totals.calls, icon: Phone },
          { label: "Texts", value: totals.texts, icon: MessageSquare },
          { label: "Recordings", value: totals.recordings, icon: Mic },
          { label: "Voicemails", value: totals.voicemails, icon: Voicemail },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Conversations</TabsTrigger>
          <TabsTrigger value="routing">Routing &amp; recording</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card className="h-fit">
              <CardContent className="p-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search number, store, message…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <ScrollArea className="h-[60vh] pr-2">
                  {isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No conversations yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {filtered.map((t) => (
                        <button
                          key={t.number}
                          onClick={() => setParams({ number: t.number })}
                          className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
                            active?.number === t.number ? "border-primary bg-muted/60" : "border-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {t.storeName || prettyPhone(t.number)}
                            </span>
                            <time className="shrink-0 text-[10px] text-muted-foreground">
                              {new Date(t.lastAt).toLocaleDateString()}
                            </time>
                          </div>
                          {t.storeName && (
                            <p className="text-[11px] text-muted-foreground">{prettyPhone(t.number)}</p>
                          )}
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.lastPreview}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {t.callCount > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {t.callCount} calls
                              </Badge>
                            )}
                            {t.smsCount > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {t.smsCount} texts
                              </Badge>
                            )}
                            {t.voicemailCount > 0 && (
                              <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">
                                {t.voicemailCount} vm
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <div>
              {active ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {active.storeName || prettyPhone(active.number)}
                    </h2>
                    <span className="text-sm text-muted-foreground">{prettyPhone(active.number)}</span>
                    {active.storeId && (
                      <Link
                        to={`/stores/${active.storeId}`}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Store className="h-3 w-3" /> Open store
                      </Link>
                    )}
                  </div>
                  <PhoneLogTimeline entries={active.entries} />
                </>
              ) : (
                <Card>
                  <CardContent className="py-20 text-center text-sm text-muted-foreground">
                    Pick a number to see the full call &amp; text history.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="mt-4 max-w-2xl">
          <VoiceRoutingSettingsCard business="gasmask" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
