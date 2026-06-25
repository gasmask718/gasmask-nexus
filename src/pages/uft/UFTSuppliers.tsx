import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Save, Trash2, Truck, Package } from "lucide-react";

type ShippingRate = {
  id: string;
  carrier: string;
  service_level: string;
  per_kg_rate: number;
  base_fee: number;
  currency: string;
  notes: string | null;
  active: boolean;
};

type KitWeight = {
  id: string;
  kit_sku: string;
  kit_name: string;
  weight_kg: number;
  dimensions: string | null;
  notes: string | null;
  confirmed_by_supplier: boolean;
};

function useEditableRows<T extends { id: string }>(table: string, orderBy: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from(table).select("*").order(orderBy);
    if (error) toast.error(`Load failed: ${error.message}`);
    else setRows((data ?? []) as T[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const update = (id: string, patch: Partial<T>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (row: T) => {
    setSaving(row.id);
    const { id, ...rest } = row as any;
    const { error } = await (supabase as any).from(table).update(rest).eq("id", id);
    setSaving(null);
    if (error) toast.error(`Save failed: ${error.message}`);
    else toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) toast.error(`Delete failed: ${error.message}`);
    else { toast.success("Deleted"); load(); }
  };

  const insert = async (row: Partial<T>) => {
    const { error } = await (supabase as any).from(table).insert(row);
    if (error) toast.error(`Add failed: ${error.message}`);
    else { toast.success("Added"); load(); }
  };

  return { rows, loading, saving, update, save, remove, insert, reload: load };
}

function ShippingRatesTable() {
  const { rows, loading, saving, update, save, remove, insert } =
    useEditableRows<ShippingRate>("ut_shipping_rates", "carrier");
  const [draft, setDraft] = useState({ carrier: "", service_level: "standard", per_kg_rate: 0, base_fee: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Carrier Shipping Rates</CardTitle>
        <p className="text-sm text-muted-foreground">Edit per-kg rate when carrier prices change. Start a Business kits only.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="w-32">Per kg ($)</TableHead>
                <TableHead className="w-32">Base fee ($)</TableHead>
                <TableHead className="w-24">Active</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
              {!loading && rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell><Input value={r.carrier} onChange={e => update(r.id, { carrier: e.target.value })} /></TableCell>
                  <TableCell><Input value={r.service_level} onChange={e => update(r.id, { service_level: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" step="0.0001" value={r.per_kg_rate} onChange={e => update(r.id, { per_kg_rate: Number(e.target.value) })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={r.base_fee} onChange={e => update(r.id, { base_fee: Number(e.target.value) })} /></TableCell>
                  <TableCell><Checkbox checked={r.active} onCheckedChange={v => update(r.id, { active: !!v })} /></TableCell>
                  <TableCell><Input value={r.notes ?? ""} onChange={e => update(r.id, { notes: e.target.value })} /></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}><Save className="h-3 w-3 mr-1" />Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 border-t pt-4">
          <h4 className="font-medium mb-2">Add carrier rate</h4>
          <div className="flex flex-wrap gap-2 items-end">
            <Input placeholder="Carrier" className="w-40" value={draft.carrier} onChange={e => setDraft({ ...draft, carrier: e.target.value })} />
            <Input placeholder="Service" className="w-32" value={draft.service_level} onChange={e => setDraft({ ...draft, service_level: e.target.value })} />
            <Input type="number" step="0.0001" placeholder="Per kg" className="w-28" value={draft.per_kg_rate} onChange={e => setDraft({ ...draft, per_kg_rate: Number(e.target.value) })} />
            <Input type="number" step="0.01" placeholder="Base fee" className="w-28" value={draft.base_fee} onChange={e => setDraft({ ...draft, base_fee: Number(e.target.value) })} />
            <Button onClick={async () => {
              if (!draft.carrier.trim()) { toast.error("Carrier required"); return; }
              await insert(draft as any);
              setDraft({ carrier: "", service_level: "standard", per_kg_rate: 0, base_fee: 0 });
            }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KitWeightsTable() {
  const { rows, loading, saving, update, save, remove, insert } =
    useEditableRows<KitWeight>("ut_kit_weights", "kit_sku");
  const [draft, setDraft] = useState({ kit_sku: "", kit_name: "", weight_kg: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Kit Weights</CardTitle>
        <p className="text-sm text-muted-foreground">Update once supplier confirms actual physical weight of each kit.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Kit Name</TableHead>
                <TableHead className="w-32">Weight (kg)</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead className="w-28">Confirmed</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
              {!loading && rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell><Input value={r.kit_sku} onChange={e => update(r.id, { kit_sku: e.target.value })} /></TableCell>
                  <TableCell><Input value={r.kit_name} onChange={e => update(r.id, { kit_name: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" step="0.001" value={r.weight_kg} onChange={e => update(r.id, { weight_kg: Number(e.target.value) })} /></TableCell>
                  <TableCell><Input value={r.dimensions ?? ""} onChange={e => update(r.id, { dimensions: e.target.value })} /></TableCell>
                  <TableCell><Checkbox checked={r.confirmed_by_supplier} onCheckedChange={v => update(r.id, { confirmed_by_supplier: !!v })} /></TableCell>
                  <TableCell><Input value={r.notes ?? ""} onChange={e => update(r.id, { notes: e.target.value })} /></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}><Save className="h-3 w-3 mr-1" />Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 border-t pt-4">
          <h4 className="font-medium mb-2">Add kit</h4>
          <div className="flex flex-wrap gap-2 items-end">
            <Input placeholder="SKU" className="w-40" value={draft.kit_sku} onChange={e => setDraft({ ...draft, kit_sku: e.target.value })} />
            <Input placeholder="Kit name" className="w-64" value={draft.kit_name} onChange={e => setDraft({ ...draft, kit_name: e.target.value })} />
            <Input type="number" step="0.001" placeholder="Weight kg" className="w-32" value={draft.weight_kg} onChange={e => setDraft({ ...draft, weight_kg: Number(e.target.value) })} />
            <Button onClick={async () => {
              if (!draft.kit_sku.trim() || !draft.kit_name.trim()) { toast.error("SKU and name required"); return; }
              await insert(draft as any);
              setDraft({ kit_sku: "", kit_name: "", weight_kg: 0 });
            }}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UFTSuppliers() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">UFT Suppliers</h1>
        <p className="text-muted-foreground">Manage supplier shipping rates and kit weights for Start a Business kits.</p>
      </div>

      <Tabs defaultValue="shipping">
        <TabsList>
          <TabsTrigger value="shipping">Shipping Rates</TabsTrigger>
        </TabsList>
        <TabsContent value="shipping" className="space-y-6 mt-4">
          <ShippingRatesTable />
          <KitWeightsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
