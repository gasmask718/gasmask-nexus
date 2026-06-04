import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteButton } from "@/components/invites/InviteButton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { DDShell } from "@/components/dynasty-direct/DDShell";
import { DDPageHeader } from "@/components/dynasty-direct/DDPageHeader";
import { DDEmpty, DDSkeleton } from "@/components/dynasty-direct/DDStates";

export default function DynastyDirectInvites() {
  const qc = useQueryClient();
  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["dd-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: unlinkedWholesalers = [] } = useQuery({
    queryKey: ["dd-unlinked-wholesalers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wholesaler_profiles")
        .select("id, company_name, contact_name, phone, email, status")
        .is("user_id", null);
      return data || [];
    },
  });

  async function revoke(id: string) {
    const { error } = await supabase.rpc("revoke_invite", { p_id: id });
    if (error) return toast.error(error.message);
    toast.success("Revoked");
    qc.invalidateQueries({ queryKey: ["dd-invites"] });
  }

  async function resend(inv: any) {
    const { error } = await supabase.functions.invoke("send-invite", {
      body: {
        role: inv.role,
        target_link: inv.target_link,
        phone: inv.sent_to_phone,
        email: inv.sent_to_email,
        name: inv.sent_name,
        channel: inv.channel,
      },
    });
    if (error) return toast.error(error.message);
    toast.success("Re-sent");
    qc.invalidateQueries({ queryKey: ["dd-invites"] });
  }

  const statusBadge = (s: string) => {
    const map: any = { sent: "secondary", opened: "default", accepted: "default", expired: "outline", revoked: "destructive" };
    return <Badge variant={map[s] || "secondary"}>{s}</Badge>;
  };

  return (
    <DDShell>
      <DDPageHeader
        icon={Send}
        title="Invites & Access"
        purpose="Universal invite system — wholesaler, ambassador, store, customer."
        crumbs={[{ label: 'Invites' }]}
        action={
          <div className="flex gap-2 flex-wrap">
            <InviteButton role="wholesaler" variant="default" label="Invite Wholesaler" />
            <InviteButton role="ambassador" variant="default" label="Invite Ambassador" />
            <InviteButton role="store" variant="default" label="Invite Store" />
            <InviteButton role="customer" variant="default" label="Invite Customer" />
          </div>
        }
      />

      {unlinkedWholesalers.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30 mb-6">
          <h2 className="font-semibold mb-3">Unlinked Wholesaler Profiles ({unlinkedWholesalers.length})</h2>
          <p className="text-xs text-muted-foreground mb-3">
            These wholesaler records have no user account yet. Send an invite to pre-link.
          </p>
          <div className="grid gap-2">
            {unlinkedWholesalers.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between bg-card border rounded p-2 text-sm">
                <div>
                  <div className="font-medium">{w.company_name}</div>
                  <div className="text-xs text-muted-foreground">{w.email} · {w.phone || "no phone"} · {w.status}</div>
                </div>
                <InviteButton
                  role="wholesaler"
                  targetLink={{ wholesaler_profile_id: w.id, company_name: w.company_name }}
                  defaultName={w.contact_name || w.company_name}
                  defaultEmail={w.email || ""}
                  defaultPhone={w.phone || ""}
                  label="Invite & Link"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && <DDSkeleton rows={5} />}
      {!isLoading && invites.length === 0 && (
        <DDEmpty
          icon={Send}
          title="No invites sent yet"
          description="Pick a role above and send your first invite. Recipients land on /invite/<token> and self-claim their account."
        />
      )}

      {!isLoading && invites.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2">Role</th>
                <th className="p-2">Sent To</th>
                <th className="p-2">Channel</th>
                <th className="p-2">Status</th>
                <th className="p-2">Created</th>
                <th className="p-2">Expires</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i: any) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2"><Badge variant="outline">{i.role}</Badge></td>
                  <td className="p-2">
                    <div className="font-medium">{i.sent_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{i.sent_to_phone || i.sent_to_email}</div>
                  </td>
                  <td className="p-2">{i.channel}</td>
                  <td className="p-2">{statusBadge(i.status)}</td>
                  <td className="p-2 text-xs text-muted-foreground">{formatDistanceToNow(new Date(i.created_at))} ago</td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(i.expires_at).toLocaleDateString()}</td>
                  <td className="p-2 space-x-1">
                    {i.status !== "accepted" && i.status !== "revoked" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => resend(i)}>Resend</Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>Revoke</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/invite/${i.token}`);
                      toast.success("Link copied");
                    }}>Copy link</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DDShell>
  );
}
