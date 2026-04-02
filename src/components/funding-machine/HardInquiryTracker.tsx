import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Search } from "lucide-react";

interface Props {
  clientId: string;
}

interface InquiryItem {
  id: string;
  creditor_name: string | null;
  inquiry_date: string | null;
  bureau: string | null;
}

export default function HardInquiryTracker({ clientId }: Props) {
  const { data: inquiries = [] } = useQuery({
    queryKey: ["inquiry-tracker", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("funding_credit_items")
        .select("id, creditor_name, inquiry_date, bureau")
        .eq("client_id", clientId)
        .eq("item_type", "Hard Inquiry");
      return (data || []) as InquiryItem[];
    },
  });

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const bureaus = [
    { key: "TransUnion", label: "TransUnion", color: "blue" },
    { key: "Equifax", label: "Equifax", color: "red" },
    { key: "Experian", label: "Experian", color: "emerald" },
  ];

  const getBureauInquiries = (bureauKey: string) => {
    return inquiries
      .filter(i => i.bureau === bureauKey && i.inquiry_date)
      .filter(i => new Date(i.inquiry_date!) >= oneYearAgo)
      .sort((a, b) => new Date(a.inquiry_date!).getTime() - new Date(b.inquiry_date!).getTime());
  };

  const getProgressColor = (count: number) => {
    if (count >= 6) return "bg-red-500";
    if (count >= 4) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getDropOffDate = (inquiryDate: string) => {
    const d = new Date(inquiryDate);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  };

  const getDaysUntil = (date: Date) => Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-400">
          <Search className="h-5 w-5" /> Hard Inquiry Concentration — 12 Month Rolling Window
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bureaus.map(b => {
            const bInqs = getBureauInquiries(b.key);
            const count = bInqs.length;
            const progressValue = Math.min((count / 8) * 100, 100);
            const oldest = bInqs[0];
            const oldestDropOff = oldest ? getDropOffDate(oldest.inquiry_date!) : null;
            const daysUntilDropOff = oldestDropOff ? getDaysUntil(oldestDropOff) : null;

            return (
              <div key={b.key} className="space-y-3">
                <div className="text-center">
                  <h4 className={`font-bold text-${b.color}-400`}>{b.label}</h4>
                  <div className={`text-4xl font-black mt-1 ${count >= 6 ? "text-red-400" : count >= 4 ? "text-amber-400" : "text-emerald-400"}`}>
                    {count}
                  </div>
                  <p className="text-xs text-muted-foreground">inquiries (12mo)</p>
                </div>

                <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${getProgressColor(count)}`} style={{ width: `${progressValue}%` }} />
                </div>

                {count >= 6 && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">Bureau saturated — do not apply for new credit pulling this bureau</p>
                  </div>
                )}
                {count >= 4 && count < 6 && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">Approaching concentration limit — pause new applications at this bureau</p>
                  </div>
                )}

                {/* Inquiry list */}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {bInqs.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No inquiries</p>}
                  {bInqs.map(inq => {
                    const dropOff = getDropOffDate(inq.inquiry_date!);
                    const daysLeft = getDaysUntil(dropOff);
                    const droppingSoon = daysLeft <= 60 && daysLeft > 0;
                    return (
                      <div key={inq.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20">
                        <span className="truncate flex-1">{inq.creditor_name}</span>
                        <span className="text-muted-foreground mx-2">{new Date(inq.inquiry_date!).toLocaleDateString()}</span>
                        <span className={droppingSoon ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                          {daysLeft <= 0 ? "Dropped" : `${daysLeft}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Drop-off stats */}
                {oldestDropOff && daysUntilDropOff !== null && daysUntilDropOff > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border/30">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Next drop-off</span>
                      <span className="font-medium">{oldestDropOff.toLocaleDateString()} ({daysUntilDropOff}d)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Count after drop-off</span>
                      <span className="font-medium">{count - 1}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
