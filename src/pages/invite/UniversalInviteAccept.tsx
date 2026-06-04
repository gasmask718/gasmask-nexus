import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROLE_THEME: Record<string, { title: string; sub: string; color: string }> = {
  wholesaler: { title: "Wholesaler", sub: "You've been invited to Dynasty Direct as a Wholesaler.", color: "bg-indigo-600" },
  ambassador: { title: "Ambassador", sub: "Join Dynasty as an Ambassador.", color: "bg-amber-600" },
  store: { title: "Store Owner", sub: "Your store has been invited to the Dynasty Direct store portal.", color: "bg-emerald-600" },
  customer: { title: "Customer", sub: "Welcome to your Dynasty Direct customer portal.", color: "bg-sky-600" },
};

export default function UniversalInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
      const row: any = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setErr("Invite not found or expired.");
      } else {
        setInvite(row);
        setEmail(row.sent_to_email || "");
        setPhone(row.sent_to_phone || "");
        setName(row.sent_name || row.inviter_display_name || "");
        supabase.rpc("mark_invite_opened", { p_token: token });

        if (row.status === "accepted") setErr("This invite has already been used.");
        if (row.status === "revoked") setErr("This invite was revoked.");
        if (row.status === "expired" || (row.expires_at && new Date(row.expires_at) < new Date())) setErr("This invite has expired.");
      }
      setLoading(false);
    })();
  }, [token]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !invite) return;
    setSubmitting(true);
    try {
      const credEmail = email || `${phone.replace(/\D/g, "")}@invite.dynasty.local`;
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        const { error: suErr } = await supabase.auth.signUp({
          email: credEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/invite/${token}`,
            data: { full_name: name, phone, invite_token: token },
          },
        });
        if (suErr) {
          // try sign-in fallback
          const { error: siErr } = await supabase.auth.signInWithPassword({ email: credEmail, password });
          if (siErr) throw suErr;
        }
      }
      const { data: acc, error: accErr } = await supabase.rpc("accept_invite", { p_token: token });
      if (accErr) throw accErr;
      const r = acc as any;
      if (!r?.success) throw new Error(r?.error || "accept_failed");
      toast.success(`Welcome — you're set up as ${r.role}`);
      navigate(r.redirect || "/");
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invite…</div>;
  if (err) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">Invite unavailable</h1>
        <p className="text-sm text-muted-foreground">{err}</p>
      </div>
    </div>
  );

  const theme = ROLE_THEME[invite.role] || ROLE_THEME.customer;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-card border rounded-xl p-6 space-y-4 shadow">
        <div className={`${theme.color} text-white rounded-lg p-4`}>
          <Badge variant="secondary" className="mb-2">{invite.role.toUpperCase()}</Badge>
          <h1 className="text-2xl font-bold">You're invited — {theme.title}</h1>
          <p className="text-sm opacity-90 mt-1">{theme.sub}</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="n">Full name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="e">Email</Label>
            <Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p">Phone</Label>
            <Input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw">Set a password</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Setting up…" : `Activate ${theme.title} Account`}
        </Button>
      </form>
    </div>
  );
}
