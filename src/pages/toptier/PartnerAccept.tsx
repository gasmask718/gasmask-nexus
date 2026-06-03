import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

type DispatchInfo = {
  found: boolean;
  reason?: string;
  dispatch_id?: string;
  dispatch_status?: string;
  booking_reference?: string;
  service_type?: string;
  service_category?: string;
  pickup_location?: string;
  dropoff_location?: string;
  scheduled_at?: string;
  special_requests?: string;
  total_price?: number;
  expires_at?: string;
  accepted_partner_id?: string;
  partner_id?: string;
  partner_name?: string;
  is_winner?: boolean;
  declined_at?: string | null;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "won"; ref?: string }
  | { kind: "lost" }
  | { kind: "declined" }
  | { kind: "error"; message: string };

export default function PartnerAccept() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<DispatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function load() {
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("tt_get_dispatch_by_token", {
      p_token: token,
    });
    if (error) {
      setOutcome({ kind: "error", message: error.message });
    } else {
      setInfo(data as DispatchInfo);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setOutcome({ kind: "submitting" });
    const { data, error } = await supabase.functions.invoke("tt-claim-via-link", {
      body: { token },
    });
    if (error) {
      setOutcome({ kind: "error", message: error.message });
      return;
    }
    const result = data as { outcome: string; finalize_result?: any; reason?: string };
    if (result.outcome === "won") {
      setOutcome({ kind: "won", ref: info?.booking_reference });
      load();
    } else if (result.outcome === "lost") {
      setOutcome({ kind: "lost" });
      load();
    } else if (result.outcome === "invalid") {
      setOutcome({ kind: "error", message: result.reason || "Invalid link" });
    } else {
      setOutcome({ kind: "error", message: result.reason || result.outcome });
    }
  }

  async function handleDecline() {
    if (!token) return;
    setOutcome({ kind: "submitting" });
    const { error } = await supabase.rpc("tt_decline_dispatch", { p_token: token });
    if (error) {
      setOutcome({ kind: "error", message: error.message });
      return;
    }
    setOutcome({ kind: "declined" });
    load();
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading job…
        </div>
      </Shell>
    );
  }

  if (!info || !info.found) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Invalid link
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            This accept link isn't valid. It may have expired or been mistyped.
            Contact TopTier dispatch if you believe this is wrong.
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const alreadyClaimedByOther =
    info.dispatch_status === "accepted" && info.accepted_partner_id !== info.partner_id;
  const claimedByMe = info.is_winner === true;
  const expired =
    info.expires_at && new Date(info.expires_at).getTime() < Date.now() &&
    info.dispatch_status === "sent";

  const scheduled = info.scheduled_at
    ? new Date(info.scheduled_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "TBD";

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            TopTier Job · {info.booking_reference}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Driver: <span className="font-medium">{info.partner_name}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Service" value={(info.service_type || "").replace(/_/g, " ")} />
          <Row label="Pickup" value={info.pickup_location || "TBD"} />
          {info.dropoff_location && (
            <Row label="Dropoff" value={info.dropoff_location} />
          )}
          <Row label="Date" value={scheduled} />
          <Row label="Value" value={`$${info.total_price ?? 0}`} />
          {info.special_requests && (
            <Row label="Notes" value={info.special_requests} />
          )}

          <div className="pt-3">
            {outcome.kind === "won" || claimedByMe ? (
              <Status
                icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                title="You got the job."
                body="Details confirmed. TopTier will text full customer + route info shortly."
              />
            ) : outcome.kind === "lost" || alreadyClaimedByOther ? (
              <Status
                icon={<XCircle className="h-5 w-5 text-destructive" />}
                title="Already accepted by another driver."
                body="Thanks for jumping on it — this one's spoken for."
              />
            ) : outcome.kind === "declined" || info.declined_at ? (
              <Status
                icon={<XCircle className="h-5 w-5 text-muted-foreground" />}
                title="Declined."
                body="No further action needed."
              />
            ) : expired ? (
              <Status
                icon={<Clock className="h-5 w-5 text-muted-foreground" />}
                title="This offer expired."
                body=""
              />
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleAccept}
                  disabled={outcome.kind === "submitting"}
                  className="flex-1"
                >
                  {outcome.kind === "submitting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Accept"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={outcome.kind === "submitting"}
                  className="flex-1"
                >
                  Decline
                </Button>
              </div>
            )}

            {outcome.kind === "error" && (
              <p className="text-sm text-destructive mt-3">{outcome.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function Status({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center gap-2 font-medium">
        {icon} {title}
      </div>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}
