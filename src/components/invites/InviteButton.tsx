import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send } from "lucide-react";

export type InviteRole = "wholesaler" | "ambassador" | "store" | "customer" | "va" | "driver" | "biker" | "production";

interface Props {
  role: InviteRole;
  targetLink?: Record<string, any>;
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function InviteButton({
  role,
  targetLink = {},
  defaultName = "",
  defaultPhone = "",
  defaultEmail = "",
  label,
  variant = "outline",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [channel, setChannel] = useState<"sms" | "email" | "both">("email");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (email && isLikelyInternationalPhone(phone)) setChannel("email");
  }, [email, phone]);

  async function send() {
    if (!phone && !email) {
      toast.error("Phone or email required");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { role, target_link: targetLink, name, phone, email, channel },
      });
      if (error) {
        const details = (error as any)?.context ? await (error as any).context.text() : error.message;
        throw new Error(details || error.message);
      }
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      toast.success(`Invite sent to ${phone || email}`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {label ?? `Invite ${role}`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite — {role}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1... or +63..." />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Channel</Label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="both">Both</option>
            </select>
          </div>
          <Button onClick={send} disabled={sending} className="w-full">
            {sending ? "Sending…" : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isLikelyInternationalPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 && !(
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith("1"))
  );
}
