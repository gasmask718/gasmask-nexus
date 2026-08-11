import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, X, Search, RefreshCw } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-300 border-green-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

type Application = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  socials: Record<string, string> | null;
  follower_ranges: Record<string, string> | null;
  why_join: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default function ClipperApplications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["clipper-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Application[];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data, error } = await supabase.functions.invoke("clipper-approve-application", {
        body: {
          application_id: id,
          decision: status,
          login_base: window.location.origin,
        },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Approval failed");
      return data as any;
    },
    onSuccess: (d: any, v) => {
      qc.invalidateQueries({ queryKey: ["clipper-applications"] });
      if (v.status === "approved") {
        toast.success(
          d?.already_approved
            ? "Already approved"
            : `Approved — account created${d?.email_sent ? " and approval email sent" : ", but the email did not send"}`,
        );
      } else {
        toast.success("Application rejected");
      }
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update application"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || [])
      .filter((a) => (tab === "all" ? true : a.status === tab))
      .filter((a) => !q || a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [data, tab, search]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    (data || []).forEach((a) => { if (a.status in c) (c as any)[a.status]++; });
    return c;
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clipper Applications</h1>
          <p className="text-sm text-muted-foreground">Review queue for public /apply submissions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all">All ({data?.length || 0})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search name or email"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">No applications in this view.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{a.full_name}</h3>
                      <Badge variant="outline" className={STATUS_BADGE[a.status]}>{a.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {a.email}{a.phone ? ` · ${a.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {fmtDate(a.created_at)}
                      {a.reviewed_at ? ` · Reviewed ${fmtDate(a.reviewed_at)}` : ""}
                    </p>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={review.isPending}
                        onClick={() => review.mutate({ id: a.id, status: "approved" })}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={review.isPending}
                        onClick={() => review.mutate({ id: a.id, status: "rejected" })}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(a.socials || {}).map(([platform, handle]) => (
                    <Badge key={platform} variant="secondary" className="font-normal">
                      {platform}: {handle}
                      {a.follower_ranges?.[platform] ? ` (${a.follower_ranges[platform]})` : ""}
                    </Badge>
                  ))}
                </div>

                {a.why_join && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-3">
                    {a.why_join}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
