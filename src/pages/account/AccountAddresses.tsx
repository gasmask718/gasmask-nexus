import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";

interface AddressPayload {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}

interface AddressRow {
  id: string;
  label: string | null;
  address: AddressPayload;
  is_default: boolean;
}

const EMPTY_ADDRESS: AddressPayload = {
  name: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "USA",
  phone: "",
};

export default function AccountAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddressRow | null>(null);
  const [label, setLabel] = useState("Home");
  const [form, setForm] = useState<AddressPayload>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("addresses" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Failed to load addresses: ${error.message}`);
    } else {
      setAddresses((data || []) as any as AddressRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openNew = () => {
    setEditing(null);
    setLabel("Home");
    setForm(EMPTY_ADDRESS);
    setDialogOpen(true);
  };

  const openEdit = (row: AddressRow) => {
    setEditing(row);
    setLabel(row.label || "Home");
    setForm({ ...EMPTY_ADDRESS, ...row.address });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name || !form.street1 || !form.city || !form.state || !form.zip) {
      toast.error("Please fill in name, street, city, state, and zip.");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("addresses" as any)
        .update({ label, address: form as any })
        .eq("id", editing.id)
        .eq("user_id", user.id);
      if (error) {
        toast.error(`Failed to update address: ${error.message}`);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("addresses" as any).insert({
        user_id: user.id,
        label,
        address: form as any,
        is_default: addresses.length === 0,
      });
      if (error) {
        toast.error(`Failed to save address: ${error.message}`);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setDialogOpen(false);
    toast.success("Address saved");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("addresses" as any).delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      toast.error(`Failed to delete address: ${error.message}`);
      return;
    }
    toast.success("Address removed");
    load();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    const { error: clearError } = await supabase
      .from("addresses" as any)
      .update({ is_default: false })
      .eq("user_id", user.id);
    if (clearError) {
      toast.error(`Failed to update defaults: ${clearError.message}`);
      return;
    }
    const { error } = await supabase.from("addresses" as any).update({ is_default: true }).eq("id", id);
    if (error) {
      toast.error(`Failed to set default: ${error.message}`);
      return;
    }
    toast.success("Default address updated");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Addresses</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Address" : "Add Address"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Work, etc." />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Street Address</Label>
                <Input value={form.street1} onChange={(e) => setForm({ ...form, street1: e.target.value })} />
              </div>
              <div>
                <Label>Apt / Suite (optional)</Label>
                <Input value={form.street2} onChange={(e) => setForm({ ...form, street2: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ZIP</Label>
                  <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No saved addresses yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{row.label || "Address"}</CardTitle>
                  {row.is_default && <Badge>Default</Badge>}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-0.5">
                <p>{row.address.name}</p>
                <p>{row.address.street1}{row.address.street2 ? `, ${row.address.street2}` : ""}</p>
                <p>{row.address.city}, {row.address.state} {row.address.zip}</p>
                <p>{row.address.phone}</p>
              </CardContent>
              <CardFooter className="flex gap-2">
                {!row.is_default && (
                  <Button variant="outline" size="sm" onClick={() => handleSetDefault(row.id)}>
                    <Star className="h-3.5 w-3.5 mr-1" />
                    Set default
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
