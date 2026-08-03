import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ClientPortalLogin from "./ClientPortalLogin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Headset, LogOut, Phone } from "lucide-react";

type ClientRow = {
  id: string;
  business_name: string;
  email: string;
  plan: string;
  status: string;
  twilio_phone_number: string | null;
  receptionist_name: string;
  total_calls_handled: number;
  calls_this_month: number;
};

/**
 * CLIENT-1: auth shell for the receptionist client portal.
 * Signed-in users are matched to their paid client record via
 * claim_receptionist_client_account(); dashboard tabs land in CLIENT-2.
 */
export default function ClientPortalPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [client, setClient] = useState<ClientRow | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      setClient(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setChecking(true);
      // Link this login to the client record that matches the email they paid with.
      await (supabase as any).rpc("claim_receptionist_client_account");
      const { data } = await supabase
        .from("brandaro_receptionist_clients")
        .select(
          "id,business_name,email,plan,status,twilio_phone_number,receptionist_name,total_calls_handled,calls_this_month"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setClient((data as ClientRow) ?? null);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || (user && checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <ClientPortalLogin />;

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader>
            <CardTitle>No account found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              We couldn't find an AI Receptionist account for <strong>{user.email}</strong>. Please sign in
              with the email address you used when you paid, or contact support.
            </p>
            <Button variant="outline" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Headset className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate">{client.business_name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {client.receptionist_name} · {client.plan} · {client.status}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Card className="border-border">
          <CardContent className="p-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Your receptionist number</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                {client.twilio_phone_number || "Provisioning…"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Calls this month</p>
              <p className="text-lg font-semibold">{client.calls_this_month}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Calls handled (total)</p>
              <p className="text-lg font-semibold">{client.total_calls_handled}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
