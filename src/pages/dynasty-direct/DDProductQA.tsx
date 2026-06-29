// Dynasty Direct — Product Q&A management
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { MessageCircle, AlertTriangle, CheckCircle2, XCircle, Pencil } from "lucide-react";

type QAStatus = "pending" | "answered" | "rejected";

interface QARow {
  id: string;
  product_id: string;
  user_id: string | null;
  asker_email: string | null;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  status: QAStatus;
  created_at: string;
  product?: { id: string; name: string | null; image_url: string | null } | null;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

const statusBadge = (s: QAStatus) => {
  if (s === "answered")
    return <Badge className="bg-green-600 hover:bg-green-600">Answered</Badge>;
  if (s === "rejected")
    return <Badge variant="secondary">Rejected</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500">Pending</Badge>;
};

export default function DDProductQA() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | QAStatus>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<QARow | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answeredBy, setAnsweredBy] = useState("Dynasty Direct");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dd_product_qa"],
    queryFn: async (): Promise<QARow[]> => {
      const { data, error } = await supabase
        .from("dd_product_qa" as never)
        .select("*")
        .order("status", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data ?? []) as unknown as QARow[];

      const ids = Array.from(new Set(list.map((r) => r.product_id))).filter(Boolean);
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products_all")
          .select("id, name, image_url")
          .in("id", ids);
        const map = new Map(
          (prods ?? []).map((p: { id: string; name: string | null; image_url: string | null }) => [p.id, p]),
        );
        list.forEach((r) => {
          r.product = map.get(r.product_id) ?? null;
        });
      }
      return list;
    },
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const answered = rows.filter((r) => r.status === "answered").length;
    const rate = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, pending, answered, rate };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const publishMutation = useMutation({
    mutationFn: async (payload: { row: QARow; answer: string; by: string }) => {
      const { error } = await supabase
        .from("dd_product_qa" as never)
        .update({
          status: "answered",
          answer: payload.answer,
          answered_by: payload.by,
          answered_at: new Date().toISOString(),
        } as never)
        .eq("id", payload.row.id);
      if (error) throw error;

      if (payload.row.asker_email) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "qa-answered",
              recipientEmail: payload.row.asker_email,
              idempotencyKey: `qa-answer-${payload.row.id}`,
              templateData: {
                product_name: payload.row.product?.name ?? "your product",
                question: payload.row.question,
                answer: payload.answer,
              },
            },
          });
        } catch (e) {
          console.warn("[DDProductQA] asker email failed", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Answer published!");
      qc.invalidateQueries({ queryKey: ["dd_product_qa"] });
      setEditing(null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to publish answer"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dd_product_qa" as never)
        .update({ status: "rejected" } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question rejected");
      qc.invalidateQueries({ queryKey: ["dd_product_qa"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to reject"),
  });

  const openAnswer = (r: QARow) => {
    setEditing(r);
    setAnswerText(r.answer ?? "");
    setAnsweredBy(r.answered_by ?? "Dynasty Direct");
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageCircle className="h-7 w-7" /> Product Q&amp;A
        </h1>
        <p className="text-muted-foreground mt-1">
          Answer customer questions to publish them on product pages.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-3xl font-bold text-amber-500">{stats.pending}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Answered</div>
          <div className="text-3xl font-bold text-green-600">{stats.answered}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-3xl font-bold">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">Response Rate</div>
          <div className="text-3xl font-bold">{stats.rate}%</div>
        </CardContent></Card>
      </div>

      {stats.pending > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="font-semibold">
                {stats.pending} question{stats.pending === 1 ? "" : "s"} waiting for an answer.
              </div>
              <div className="text-sm text-muted-foreground">
                Unanswered questions are not visible to customers.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="answered">Answered</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No questions in this view.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Asked</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isOpen = expanded === r.id;
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <TableCell className="max-w-[200px] truncate">
                          {r.product?.name ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {r.question}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt(r.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.asker_email ?? <span className="text-muted-foreground">Guest</span>}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {r.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => openAnswer(r)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Answer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => rejectMutation.mutate(r.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                          {r.status === "answered" && (
                            <Button size="sm" variant="outline" onClick={() => openAnswer(r)}>
                              Edit Answer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${r.id}-exp`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="flex gap-4 py-3">
                              {r.product?.image_url && (
                                <img
                                  src={r.product.image_url}
                                  alt={r.product?.name ?? ""}
                                  className="w-20 h-20 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 space-y-2 text-sm">
                                <div className="font-semibold">{r.product?.name ?? "—"}</div>
                                <div><span className="text-muted-foreground">Question:</span> {r.question}</div>
                                <div className="text-muted-foreground">
                                  From {r.asker_email ?? "Guest"} · {fmt(r.created_at)}
                                </div>
                                {r.status === "answered" && (
                                  <div className="pt-2 border-t">
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                      <CheckCircle2 className="h-4 w-4" />
                                      Answered by {r.answered_by ?? "—"} · {fmt(r.answered_at)}
                                    </div>
                                    <div className="mt-1 whitespace-pre-wrap">{r.answer}</div>
                                  </div>
                                )}
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

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Answer question</SheetTitle>
            <SheetDescription>
              Your answer will be visible on the product page.
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="space-y-5 mt-6">
              <div className="flex gap-3">
                {editing.product?.image_url && (
                  <img
                    src={editing.product.image_url}
                    alt={editing.product?.name ?? ""}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="font-semibold">{editing.product?.name ?? "—"}</div>
              </div>

              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Question</div>
                <div className="text-lg">{editing.question}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  Asked by {editing.asker_email ?? "Guest"} · {fmt(editing.created_at)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Your answer</label>
                <Textarea
                  rows={5}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Write a helpful answer that will be visible to all customers on this product..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Answered by</label>
                <Input
                  value={answeredBy}
                  onChange={(e) => setAnsweredBy(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    publishMutation.mutate({
                      row: editing,
                      answer: answerText.trim(),
                      by: answeredBy.trim() || "Dynasty Direct",
                    })
                  }
                  disabled={!answerText.trim() || publishMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {publishMutation.isPending ? "Publishing…" : "Publish Answer"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
