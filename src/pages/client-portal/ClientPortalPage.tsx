import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ClientPortalLogin from "./ClientPortalLogin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Headset, LogOut, LayoutDashboard, PhoneCall, Settings, CreditCard } from "lucide-react";

export type ReceptionistClient = {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string;
  plan: string;
  status: string;
  monthly_amount: number;
  setup_fee_amount: number;
  next_billing_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  twilio_phone_number: string | null;
  receptionist_name: string;
  business_hours: any;
  faqs: any;
  appointment_calendar_url: string | null;
  escalation_phone: string | null;
  total_calls_handled: number;
  calls_this_month: number;
  appointments_booked_this_month: number;
  appointments_booked_total: number;
  agent_provisioned: boolean;
  retell_agent_id: string | null;
};

const SELECT_COLS =
  "id,business_name,owner_name,email,phone,plan,status,monthly_amount,setup_fee_amount,next_billing_date," +
  "stripe_customer_id,stripe_subscription_id,twilio_phone_number,receptionist_name,business_hours,faqs," +
  "appointment_calendar_url,escalation_phone,total_calls_handled,calls_this_month," +
  "appointments_booked_this_month,appointments_booked_total,agent_provisioned,retell_agent_id";

type Ctx = { client: ReceptionistClient; refresh: () => Promise<void> };
export const useClientPortal = () => useOutletContext<Ctx>();

const TABS = [
  { to: "/client-portal", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/client-portal/calls", end: false, label: "Call History", icon: PhoneCall },
  { to: "/client-portal/settings", end: false, label: "Settings", icon: Settings },
  { to: "/client-portal/billing", end: false, label: "Billing", icon: CreditCard },
];

/**
 * CLIENT-3: portal shell — auth gate, account claim, role guard and tab nav.
 * Child pages read the client record via useClientPortal().
 */
export default function ClientPortalPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [client, setClient] = useState<ReceptionistClient | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("brandaro_receptionist_clients")
      .select(SELECT_COLS)
      .eq("auth_user_id", user!.id)
      .maybeSingle();
    setClient((data as unknown as ReceptionistClient) ?? null);
  }, [user]);

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
        .select(SELECT_COLS)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setClient((data as unknown as ReceptionistClient) ?? null);
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
        <nav className="max-w-5xl mx-auto flex gap-1 overflow-x-auto px-2">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <Outlet context={{ client, refresh: load } satisfies Ctx} />
      </main>
    </div>
  );
}
