import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Account = {
  id: string;
  full_name: string;
  email: string;
  status: string | null;
  tier: string | null;
  total_views: number | null;
  total_earnings: number | null;
};

/**
 * Clipper portal home. Only an ACTIVE clipper_accounts row bound to the
 * signed-in user grants access — everyone else sees the "not approved" state.
 */
export default function ClipperPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/clipper/login", { replace: true });
        return;
      }
      setSignedIn(true);
      const { data } = await supabase
        .from("clipper_accounts")
        .select("id, full_name, email, status, tier, total_views, total_earnings")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      setAccount((data as Account) ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/clipper/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const active = signedIn && account && (account.status ?? "").toLowerCase() === "active";

  if (!active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 space-y-4 text-center">
            <h1 className="text-xl font-bold text-foreground">Not approved yet</h1>
            <p className="text-sm text-muted-foreground">
              This account doesn't have an active Clipper Nation membership. Once your application
              is approved you'll get an email with your login link.
            </p>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome, {account!.full_name}</h1>
            <p className="text-sm text-muted-foreground">{account!.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Active clipper</Badge>
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Tier</p>
            <p className="text-xl font-semibold text-foreground">{account!.tier || "Starter"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total views</p>
            <p className="text-xl font-semibold text-foreground">
              {(account!.total_views ?? 0).toLocaleString()}
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total earnings</p>
            <p className="text-xl font-semibold text-foreground">
              ${Number(account!.total_earnings ?? 0).toFixed(2)}
            </p>
          </CardContent></Card>
        </div>

        <Card><CardContent className="pt-6 space-y-2">
          <h2 className="font-semibold text-foreground">Next steps</h2>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li>Connect your social accounts</li>
            <li>Pick up your campaign assignments</li>
            <li>Post content and submit your URLs</li>
            <li>Get paid every Friday</li>
          </ol>
        </CardContent></Card>
      </div>
    </div>
  );
}
