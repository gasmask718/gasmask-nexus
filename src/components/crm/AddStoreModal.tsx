import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBoroughs, useAddBorough } from "@/hooks/useBoroughs";
import { Loader2, Plus } from "lucide-react";

interface AddStoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  onSuccess?: () => void;
}

export function AddStoreModal({ open, onOpenChange, brandId, onSuccess }: AddStoreModalProps) {
  const queryClient = useQueryClient();
  const { data: boroughs = [] } = useBoroughs();
  const addBorough = useAddBorough();

  const [formData, setFormData] = useState({
    store_name: "",
    store_phone: "",
    address: "",
    city: "",
    state: "NY",
    zip: "",
    borough_id: "",
    owner_name: "",
    notes: "",
  });

  const [newBorough, setNewBorough] = useState("");
  const [showAddBorough, setShowAddBorough] = useState(false);

  const createStore = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from("store_master")
        .insert({
          ...data,
          brand_id: brandId,
          borough_id: data.borough_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-stores", brandId] });
      toast.success("Store created successfully");
      resetForm();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create store: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      store_name: "",
      store_phone: "",
      address: "",
      city: "",
      state: "NY",
      zip: "",
      borough_id: "",
      owner_name: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.store_name.trim()) {
      toast.error("Store name is required");
      return;
    }
    createStore.mutate(formData);
  };

  const handleAddBorough = async () => {
    if (!newBorough.trim()) return;
    try {
      const result = await addBorough.mutateAsync(newBorough.trim());
      setFormData((prev) => ({ ...prev, borough_id: result.id }));
      setNewBorough("");
      setShowAddBorough(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Store</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="store_name">Store Name *</Label>
              <Input
                id="store_name"
                value={formData.store_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, store_name: e.target.value }))}
                placeholder="Store name"
              />
            </div>

            <div>
              <Label htmlFor="owner_name">Owner Name</Label>
              <Input
                id="owner_name"
                value={formData.owner_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, owner_name: e.target.value }))}
                placeholder="Owner name"
              />
            </div>

            <div>
              <Label htmlFor="store_phone">Phone</Label>
              <Input
                id="store_phone"
                value={formData.store_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, store_phone: e.target.value }))}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address"
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="City"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                  placeholder="NY"
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData((prev) => ({ ...prev, zip: e.target.value }))}
                  placeholder="10001"
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label>Borough</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.borough_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, borough_id: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select borough" />
                  </SelectTrigger>
                  <SelectContent>
                    {boroughs.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAddBorough(!showAddBorough)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {showAddBorough && (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newBorough}
                    onChange={(e) => setNewBorough(e.target.value)}
                    placeholder="New borough name"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddBorough}
                    disabled={addBorough.isPending}
                  >
                    {addBorough.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createStore.isPending}>
              {createStore.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
