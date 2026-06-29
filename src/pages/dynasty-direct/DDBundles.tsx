// Dynasty Direct — Curated Bundle admin page.
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Search, X, Package } from "lucide-react";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  discount_pct: number;
  valid_until: string | null;
  is_public: boolean;
  bundle_type: string;
  created_at: string;
};

type BundleItem = { id?: string; product_id: string; qty: number; unit_price: number; product_name?: string };

interface DraftBundle extends Partial<Bundle> { items: BundleItem[] }

export default function DDBundles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftBundle | null>(null);
  const [search, setSearch] = useState("");

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["dd-curated-bundles"],
    queryFn: async (): Promise<Bundle[]> => {
      const { data, error } = await (supabase as any)
        .from("dd_bundles")
        .select("*")
        .or("bundle_type.eq.curated,is_public.eq.true")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Bundle[];
    },
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ["dd-bundle-product-search", search],
    enabled: open && search.length >= 2,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products_all")
        .select("id, name, price")
        .ilike("name", `%${search}%`)
        .limit(10);
      return (data ?? []) as Array<{ id: string; name: string; price: number }>;
    },
  });

  async function openEdit(b: Bundle) {
    const { data: items } = await (supabase as any)
      .from("dd_bundle_items")
      .select("id, product_id, qty, unit_price, products_all:product_id(name)")
      .eq("bundle_id", b.id);
    const mapped: BundleItem[] = (items ?? []).map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      qty: i.qty,
      unit_price: Number(i.unit_price ?? 0),
      product_name: i.products_all?.name,
    }));
    setDraft({ ...b, items: mapped });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async (d: DraftBundle) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        name: d.name ?? "Untitled",
        description: d.description ?? null,
        cover_image_url: d.cover_image_url ?? null,
        discount_pct: Number(d.discount_pct ?? 0),
        valid_until: d.valid_until || null,
        is_public: d.is_public ?? true,
        bundle_type: "curated",
        created_by: u.user?.id,
      };
      let bundleId = d.id;
      if (bundleId) {
        const { error } = await (supabase as any).from("dd_bundles").update(payload).eq("id", bundleId);
        if (error) throw error;
        await (supabase as any).from("dd_bundle_items").delete().eq("bundle_id", bundleId);
      } else {
        const { data, error } = await (supabase as any).from("dd_bundles").insert(payload).select("id").single();
        if (error) throw error;
        bundleId = data.id;
      }
      if (d.items.length) {
        const itemRows = d.items.map((it) => ({
          bundle_id: bundleId,
          product_id: it.product_id,
          qty: it.qty,
          unit_price: it.unit_price,
        }));
        const { error: ie } = await (supabase as any).from("dd_bundle_items").insert(itemRows);
        if (ie) throw ie;
      }
    },
    onSuccess: () => {
      toast.success("Bundle published! Now visible to all store customers.");
      setOpen(false);
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["dd-curated-bundles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unpublish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dd_bundles").update({ is_public: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unpublished");
      qc.invalidateQueries({ queryKey: ["dd-curated-bundles"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dd_bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["dd-curated-bundles"] });
    },
  });

  const totals = useMemo(() => {
    if (!draft) return { gross: 0, net: 0, save: 0 };
    const gross = draft.items.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const net = gross * (1 - Number(draft.discount_pct ?? 0) / 100);
    return { gross, net, save: gross - net };
  }, [draft]);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" /> 📦 Featured Bundles
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Curated bundles shown to all store customers
              </p>
            </div>
            <Button
              onClick={() => {
                setDraft({ name: "", discount_pct: 10, is_public: true, items: [] });
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Create Curated Bundle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : bundles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No curated bundles yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{b.description}</div>
                    </TableCell>
                    <TableCell>{Number(b.discount_pct).toFixed(0)}%</TableCell>
                    <TableCell className="text-xs">
                      {b.valid_until ? new Date(b.valid_until).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {b.is_public ? <Badge className="bg-green-600">Live</Badge> : <Badge variant="outline">Draft</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {b.is_public && (
                        <Button size="sm" variant="ghost" onClick={() => unpublish.mutate(b.id)}>
                          Unpublish
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete "${b.name}"?`)) remove.mutate(b.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDraft(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit" : "Create"} Curated Bundle</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label>Bundle Name</Label>
                <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    value={draft.discount_pct ?? 0}
                    onChange={(e) => setDraft({ ...draft, discount_pct: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={draft.valid_until ?? ""}
                    onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch
                    checked={draft.is_public ?? true}
                    onCheckedChange={(v) => setDraft({ ...draft, is_public: v })}
                  />
                  <Label>Public</Label>
                </div>
              </div>
              <div>
                <Label>Cover Image URL</Label>
                <Input
                  value={draft.cover_image_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, cover_image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="border-t pt-3">
                <Label>Products</Label>
                <div className="relative mt-1">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {productResults.length > 0 && search.length >= 2 && (
                  <div className="border rounded mt-1 max-h-40 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                        onClick={() => {
                          if (draft.items.find((i) => i.product_id === p.id)) return;
                          setDraft({
                            ...draft,
                            items: [...draft.items, { product_id: p.id, qty: 1, unit_price: Number(p.price ?? 0), product_name: p.name }],
                          });
                          setSearch("");
                        }}
                      >
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">${Number(p.price ?? 0).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {draft.items.length > 0 && (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-20">Qty</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draft.items.map((it, idx) => (
                        <TableRow key={`${it.product_id}-${idx}`}>
                          <TableCell className="text-xs">{it.product_name ?? it.product_id.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={it.qty}
                              className="h-7"
                              onChange={(e) => {
                                const items = [...draft.items];
                                items[idx] = { ...it, qty: Math.max(1, Number(e.target.value)) };
                                setDraft({ ...draft, items });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-xs">${(it.qty * it.unit_price).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {draft.items.length > 0 && (
                  <div className="bg-muted/50 rounded p-3 mt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Regular price:</span><span>${totals.gross.toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold"><span>Bundle price:</span><span>${totals.net.toFixed(2)}</span></div>
                    <div className="flex justify-between text-green-600">
                      <span>You save:</span>
                      <span>${totals.save.toFixed(2)} ({Number(draft.discount_pct ?? 0).toFixed(0)}% off)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => draft && save.mutate(draft)}
              disabled={save.isPending || !draft?.name || draft.items.length === 0}
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save as Curated Bundle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
