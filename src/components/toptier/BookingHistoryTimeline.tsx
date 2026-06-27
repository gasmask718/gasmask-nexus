import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  CheckCircle2,
  XCircle,
  UserCheck,
  CreditCard,
  AlertTriangle,
  Sparkles,
  Pencil,
  Clock,
  Send,
} from "lucide-react";

interface Props {
  bookingId: string;
}

const ICON_MAP: Record<string, any> = {
  created: Sparkles,
  status_changed: Activity,
  completed: CheckCircle2,
  cancelled: XCircle,
  assigned_to_partner: UserCheck,
  assigned_to_decorator: UserCheck,
  accepted_by_partner: CheckCircle2,
  declined_by_partner: XCircle,
  confirmed_by_admin: CheckCircle2,
  declined_by_admin: XCircle,
  modified: Pencil,
  payment_captured: CreditCard,
  payment_failed: AlertTriangle,
  payment_status_changed: CreditCard,
  tip_added: CreditCard,
  rating_submitted: Sparkles,
  sla_breached: Clock,
  dispatch_failed: AlertTriangle,
};

const COLOR_MAP: Record<string, string> = {
  created: "text-[#C9A84C] bg-[#C9A84C]/10",
  completed: "text-emerald-400 bg-emerald-500/10",
  cancelled: "text-red-400 bg-red-500/10",
  payment_captured: "text-emerald-400 bg-emerald-500/10",
  payment_failed: "text-red-400 bg-red-500/10",
  declined_by_partner: "text-red-400 bg-red-500/10",
  declined_by_admin: "text-red-400 bg-red-500/10",
  sla_breached: "text-amber-400 bg-amber-500/10",
  dispatch_failed: "text-red-400 bg-red-500/10",
};

export function BookingHistoryTimeline({ bookingId }: Props) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["booking-events", bookingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_events")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!bookingId,
  });

  if (isLoading) {
    return <p className="text-xs text-white/40">Loading history…</p>;
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-6 text-white/40 text-sm">
        <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
        No history yet for this booking.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((evt) => {
        const Icon = ICON_MAP[evt.event_type] ?? Activity;
        const color = COLOR_MAP[evt.event_type] ?? "text-white/60 bg-white/5";
        return (
          <div key={evt.id} className="flex gap-3 p-3 rounded-md bg-white/[0.02] border border-white/5">
            <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white/80 capitalize">
                  {evt.event_type.replace(/_/g, " ")}
                </p>
                <time
                  className="text-[10px] text-white/40 shrink-0"
                  title={format(new Date(evt.created_at), "PPpp")}
                >
                  {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                </time>
              </div>
              {evt.actor_label && (
                <p className="text-xs text-white/50 mt-0.5">{evt.actor_label}</p>
              )}
              {evt.reason && (
                <p className="text-xs text-white/60 mt-1 italic">"{evt.reason}"</p>
              )}
              {evt.metadata?.from && evt.metadata?.to && (
                <p className="text-[11px] text-white/40 mt-1 font-mono">
                  {evt.metadata.from} → {evt.metadata.to}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
