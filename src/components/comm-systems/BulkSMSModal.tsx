import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bulkSendSMS } from "@/services/templateService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Rocket, Store, Loader2 } from "lucide-react";

interface BulkSMSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    content?: string;
    message_template?: string;
    category?: string;
  } | null;
}

export function BulkSMSModal({ open, onOpenChange, template }: BulkSMSModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["bulk-sms-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_master")
        .select("id, store_name, phone")
        .not("phone", "is", null)
        .order("store_name")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = stores.filter((s) =>
    s.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStore = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((s) => s.id));
    }
  };

  const handleSend = async () => {
    if (!template || selectedIds.length === 0) return;

    const recipients = stores
      .filter((s) => selectedIds.includes(s.id))
      .map((s) => ({
        phoneNumber: s.phone!,
        variables: { store_name: s.store_name ?? "" },
      }));

    setSending(true);
    try {
      const results = await bulkSendSMS(
        "default",
        template.category || "cold_outreach",
        recipients
      );
      const success = results.filter((r) => r.success).length;
      const failed = results.length - success;
      toast.success(`Bulk SMS sent: ${success} delivered, ${failed} failed`);
      setSelectedIds([]);
      onOpenChange(false);
    } catch (err) {
      toast.error("Bulk SMS failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Launch Bulk SMS
          </DialogTitle>
          <DialogDescription>
            Sending: <span className="font-medium text-foreground">{template?.name}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Search & Select All */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            {selectedIds.length === filtered.length && filtered.length > 0
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        {/* Store List */}
        <div className="border rounded-lg">
          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading stores…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No stores with phone numbers found</div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                    onClick={() => toggleStore(store.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(store.id)}
                      onCheckedChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <Label className="flex-1 cursor-pointer text-sm">
                      {store.store_name}
                    </Label>
                    <span className="text-xs text-muted-foreground">{store.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} recipient{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={selectedIds.length === 0 || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Sending…
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-1" />
                  Send to {selectedIds.length}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
