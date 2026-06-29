// Dynasty Direct — Product Reviews moderation
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, CheckCircle2, XCircle, Flag, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  product_id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean | null;
  status: "pending" | "approved" | "rejected" | "flagged";
  created_at: string;
  products_all?: { product_name: string | null; images: any } | null;
};

const statusBadge: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-700 border-amber-500/40",
  approved: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40",
  rejected: "bg-rose-500/20 text-rose-700 border-rose-500/40",
  flagged: "bg-orange-500/20 text-orange-700 border-orange-500/40",
};

const statusLabel: Record<string, string> = {
  pending: "Awaiting Review",
  approved: "Published",
  rejected: "Rejected",
  flagged: "Flagged",
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
        />
      ))}
    </div>
  );
}

export default function DDReviews() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["dd-product-reviews"],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("dd_product_reviews" as any)
        .select("*, products_all(product_name, images)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = ((data as any[]) ?? []) as Review[];
      return list.sort((a, b) => {
        const pa = a.status === "pending" ? 0 : 1;
        const pb = b.status === "pending" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
  });

  const stats = useMemo(() => {
    const pending = reviews.filter((r) => r.status === "pending").length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const approvedRatings = reviews.filter((r) => r.status === "approved").map((r) => r.rating);
    const avg = approvedRatings.length
      ? approvedRatings.reduce((a, b) => a + b, 0) / approvedRatings.length
      : 0;
    return { pending, approved, total: reviews.length, avg };
  }, [reviews]);

  const filtered = useMemo(() => {
    if (tab === "all") return reviews;
    return reviews.filter((r) => r.status === tab);
  }, [reviews, tab]);

  const setStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from("dd_product_reviews" as any)
        .update({ status })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["dd-product-reviews"] });
      setSelected(new Set());
      const verb =
        vars.status === "approved"
          ? "published"
          : vars.status === "rejected"
            ? "rejected"
            : vars.status === "flagged"
              ? "flagged"
              : "updated";
      toast.success(`${vars.ids.length} review${vars.ids.length > 1 ? "s" : ""} ${verb}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">⭐ Product Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Approve reviews to publish them on product pages
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={stats.pending} accent="amber" />
        <StatCard label="Approved" value={stats.approved} accent="emerald" />
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Avg Rating" value={stats.avg ? `★ ${stats.avg.toFixed(1)}` : "—"} />
      </div>

      {stats.pending > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5" />
          <div className="text-sm">
            <strong>{stats.pending}</strong> review{stats.pending > 1 ? "s" : ""} waiting for
            approval. They are <strong>NOT</strong> visible to customers until approved.
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/60 p-3">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setStatus.mutate({ ids: [...selected], status: "approved" })}
            disabled={setStatus.isPending}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve All
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setStatus.mutate({ ids: [...selected], status: "rejected" })}
            disabled={setStatus.isPending}
          >
            <XCircle className="w-3 h-3 mr-1" /> Reject All
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No reviews in this view.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-8" />
                  <TableHead>Product</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isExp = expanded === r.id;
                  return (
                    <>
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpanded(isExp ? null : r.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {isExp ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {r.products_all?.product_name ?? r.product_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Stars rating={r.rating} />
                        </TableCell>
                        <TableCell className="text-sm">{r.reviewer_name}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{r.title ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-center">{r.verified_purchase ? "✅" : "—"}</TableCell>
                        <TableCell>
                          <Badge className={statusBadge[r.status]} variant="outline">
                            {statusLabel[r.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            {r.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2"
                                  onClick={() => setStatus.mutate({ ids: [r.id], status: "approved" })}
                                  disabled={setStatus.isPending}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2"
                                  onClick={() => setStatus.mutate({ ids: [r.id], status: "rejected" })}
                                  disabled={setStatus.isPending}
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 border-orange-500 text-orange-700"
                                  onClick={() => setStatus.mutate({ ids: [r.id], status: "flagged" })}
                                  disabled={setStatus.isPending}
                                >
                                  <Flag className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {r.status === "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 border-rose-500 text-rose-700"
                                onClick={() => setStatus.mutate({ ids: [r.id], status: "rejected" })}
                                disabled={setStatus.isPending}
                              >
                                Take Down
                              </Button>
                            )}
                            {(r.status === "rejected" || r.status === "flagged") && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2"
                                onClick={() => setStatus.mutate({ ids: [r.id], status: "approved" })}
                                disabled={setStatus.isPending}
                              >
                                Approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExp && (
                        <TableRow key={`${r.id}-exp`}>
                          <TableCell colSpan={10} className="bg-muted/30">
                            <div className="p-4 space-y-3">
                              {r.title && <div className="font-semibold">{r.title}</div>}
                              <div className="text-sm whitespace-pre-wrap">{r.body ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.reviewer_name}
                                {r.reviewer_email ? ` · ${r.reviewer_email}` : ""} · {new Date(r.created_at).toLocaleString()}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: "amber" | "emerald" }) {
  const accentClass =
    accent === "amber"
      ? "text-amber-600"
      : accent === "emerald"
        ? "text-emerald-600"
        : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
