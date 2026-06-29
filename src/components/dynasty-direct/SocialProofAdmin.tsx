// Dynasty Direct — Social Proof admin section (DDSettings).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";

type Row = {
  id: string;
  type: "stat" | "press_mention" | "ugc_photo" | "award";
  title: string;
  content: string | null;
  image_url: string | null;
  source_url: string | null;
  display_order: number;
  is_active: boolean;
};

const TYPE_META: Record<Row["type"], { label: string; cls: string }> = {
  stat: { label: "Stat", cls: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
  press_mention: { label: "Press", cls: "bg-purple-500/15 text-purple-300 border-purple-500/40" },
  ugc_photo: { label: "Customer", cls: "bg-green-500/15 text-green-300 border-green-500/40" },
  award: { label: "Award", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
};

export default function SocialProofAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dd-social-proof"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any)
        .from("dd_social_proof")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (r: Partial<Row>) => {
      const payload: any = {
        type: r.type ?? "stat",
        title: r.title ?? "",
        content: r.content ?? null,
        image_url: r.image_url ?? null,
        source_url: r.source_url ?? null,
        display_order: Number(r.display_order ?? 0),
        is_active: r.is_active ?? true,
      };
      if (r.id) {
        const { error } = await (supabase as any).from("dd_social_proof").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("dd_social_proof").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["dd-social-proof"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dd_social_proof").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["dd-social-proof"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await (supabase as any).from("dd_social_proof").update({ is_active: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dd-social-proof"] }),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = rows.findIndex((r) => r.id === id);
      const swap = rows[idx + dir];
      if (!swap) return;
      const a = rows[idx];
      await (supabase as any).from("dd_social_proof").update({ display_order: swap.display_order }).eq("id", a.id);
      await (supabase as any).from("dd_social_proof").update({ display_order: a.display_order }).eq("id", swap.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dd-social-proof"] }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>🌟 Social Proof & Trust</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Manage stats, press mentions, and customer photos shown on the public storefront
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing({ type: "stat", display_order: rows.length, is_active: true });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No social proof yet. Add stats, press, customers, or awards.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline" className={TYPE_META[r.type].cls}>
                      {TYPE_META[r.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.content}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs w-4">{r.display_order}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => reorder.mutate({ id: r.id, dir: -1 })}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === rows.length - 1} onClick={() => reorder.mutate({ id: r.id, dir: 1 })}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, val: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${r.title}"?`)) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "Add"} Social Proof</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={editing.type ?? "stat"}
                  onValueChange={(v) => setEditing({ ...editing, type: v as Row["type"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stat">Stat</SelectItem>
                    <SelectItem value="press_mention">Press Mention</SelectItem>
                    <SelectItem value="ugc_photo">Customer Photo</SelectItem>
                    <SelectItem value="award">Award</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder={
                    editing.type === "stat" ? "10,000+ Products" :
                    editing.type === "press_mention" ? "Featured in Forbes" :
                    editing.type === "ugc_photo" ? "Customer name" : "Award name"
                  }
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={editing.content ?? ""}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Image URL (optional)</Label>
                <Input
                  value={editing.image_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Source URL (optional)</Label>
                <Input
                  value={editing.source_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Display Order</Label>
                  <Input
                    type="number"
                    value={editing.display_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => editing && upsert.mutate(editing)} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
