import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Clipper Nation portal login.
 * Password sign-in + magic-link fallback. Access to the portal itself is
 * gated on an ACTIVE clipper_accounts row (see ClipperPortal).
 */
export default function ClipperLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/clipper/portal", { replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    if (!email || !password) return toast.error("Enter your email and password.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate("/clipper/portal", { replace: true });
  };

  const magicLink = async () => {
    if (!email) return toast.error("Enter your email first.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/clipper/portal` },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Login link sent — check your email.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clipper Portal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in with the email on your approved application.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="email" placeholder="you@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email"
            />
            <Input
              type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
            <Button className="w-full" onClick={signIn} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Sign in
            </Button>
            <Button variant="outline" className="w-full" onClick={magicLink} disabled={busy}>
              Email me a login link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Not a clipper yet? <a className="underline" href="/apply">Apply here</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
