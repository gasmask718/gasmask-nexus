import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface BulkCommunicationLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BulkCommunicationLogModal = ({ open, onOpenChange, onSuccess }: BulkCommunicationLogModalProps) => {
  const [selectedStores, setSelectedStores] = useState<Array<{ id: string; name: string }>>([]);
  const [method, setMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: stores } = useQuery({
    queryKey: ['stores-for-bulk-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStores.length === 0) {
      toast({
        title: "No stores selected",
        description: "Please select at least one store",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert communication events for each selected store
      const communications = selectedStores.map(store => ({
        channel: method,
        event_type: 'manual_log',
        direction: 'outgoing',
        summary: notes,
        linked_entity_type: 'store',
        linked_entity_id: store.id,
        store_id: store.id,
        user_id: user.id,
      }));

      const { error: commError } = await supabase
        .from('communication_events')
        .insert(communications);

      if (commError) throw commError;

      // Create reminders if follow-up date is provided
      if (followUpDate) {
        const reminders = selectedStores.map(store => ({
          store_id: store.id,
          assigned_to: user.id,
          follow_up_date: followUpDate,
          notes: `Follow-up for: ${notes.substring(0, 100)}`,
        }));

        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminders);

        if (reminderError) throw reminderError;
      }

      toast({
        title: "Success",
        description: `Logged communication for ${selectedStores.length} store(s)`,
      });

      setSelectedStores([]);
      setMethod("");
      setNotes("");
      setFollowUpDate("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging bulk communications:', error);
      toast({
        title: "Error",
        description: "Failed to log communications",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStore = (store: { id: string; name: string }) => {
    setSelectedStores(prev => 
      prev.find(s => s.id === store.id)
        ? prev.filter(s => s.id !== store.id)
        : [...prev, store]
    );
  };

  const removeStore = (storeId: string) => {
    setSelectedStores(prev => prev.filter(s => s.id !== storeId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Communication Log</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Stores</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedStores.length > 0
                    ? `${selectedStores.length} store(s) selected`
                    : "Select stores..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search stores..." />
                  <CommandEmpty>No stores found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {stores?.map((store) => (
                      <CommandItem
                        key={store.id}
                        onSelect={() => toggleStore(store)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedStores.some(s => s.id === store.id)}
                            onChange={() => toggleStore(store)}
                            className="h-4 w-4"
                          />
                          <span>{store.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedStores.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedStores.map(store => (
                  <Badge key={store.id} variant="secondary" className="gap-1">
                    {store.name}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeStore(store.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-method">Communication Method</Label>
            <Select value={method} onValueChange={setMethod} required>
              <SelectTrigger id="bulk-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="visit">In-Person Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-notes">Notes</Label>
            <Textarea
              id="bulk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed or sent..."
              required
              maxLength={1000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/1000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-followup">Follow-up Date (Optional)</Label>
            <Input
              id="bulk-followup"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Communications
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};