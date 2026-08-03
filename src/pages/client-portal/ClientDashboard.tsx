import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, PhoneForwarded, CalendarCheck, PhoneCall, Loader2 } from "lucide-react";
import { useClientPortal } from "./ClientPortalPage";

export default function ClientDashboard() {
  const { client } = useClientPortal();

  const { data: recent, isLoading } = useQuery({
    queryKey: ["client-portal-recent-calls", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brandaro_receptionist_calls")
        .select("id,created_at,caller_name,caller_phone,call_duration_seconds,call_outcome,summary")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = client.status === "active";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          Welcome{client.owner_name ? `, ${client.owner_name}` : ""} — {client.business_name}
        </h2>
        <Badge
          className={
            active
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
          }
          variant="outline"
        >
          AI Receptionist {active ? "Active" : client.status}
        </Badge>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Your receptionist number
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-bold tracking-tight">
            {client.twilio_phone_number || "Provisioning…"}
          </p>
          {client.twilio_phone_number ? (
            <Alert>
              <PhoneForwarded className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Forward your calls to this number so {client.receptionist_name} can answer them 24/7.
                On iPhone: Settings → Phone → Call Forwarding. On Android: Phone app → Settings → Call
                forwarding.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              We're provisioning your number now — you'll get a text as soon as it's live.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <PhoneCall className="h-3 w-3" /> Calls answered this month
            </p>
            <p className="text-3xl font-bold">{client.calls_this_month}</p>
            <p className="text-xs text-muted-foreground">{client.total_calls_handled} all time</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarCheck className="h-3 w-3" /> Appointments booked this month
            </p>
            <p className="text-3xl font-bold">{client.appointments_booked_this_month}</p>
            <p className="text-xs text-muted-foreground">{client.appointments_booked_total} all time</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !recent?.length ? (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            recent.map((c) => (
              <div key={c.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{c.caller_name || c.caller_phone || "Unknown caller"}</span>
                  {c.call_outcome && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {c.call_outcome.replace(/_/g, " ")}
                    </Badge>
                  )}
                  <time className="ml-auto text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()}
                  </time>
                </div>
                {c.summary && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
