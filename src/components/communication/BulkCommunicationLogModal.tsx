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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { TemplateSelector } from "./TemplateSelector";

interface BulkCommunicationLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BulkCommunicationLogModal = ({ open, onOpenChange, onSuccess }: BulkCommunicationLogModalProps) => {
  const [entityType, setEntityType] = useState<'store' | 'wholesaler' | 'influencer'>('store');
  const [selectedEntities, setSelectedEntities] = useState<Array<{ id: string; name: string }>>([]);
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
    enabled: entityType === 'store',
  });

  const { data: wholesalers } = useQuery({
    queryKey: ['wholesalers-for-bulk-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_hubs')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'wholesaler',
  });

  const { data: influencers } = useQuery({
    queryKey: ['influencers-for-bulk-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: entityType === 'influencer',
  });

  const entities = entityType === 'store' ? stores : entityType === 'wholesaler' ? wholesalers : influencers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntities.length === 0) {
      toast({
        title: `No ${entityType}s selected`,
        description: `Please select at least one ${entityType}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert communication events for each selected entity
      const communications = selectedEntities.map(entity => ({
        channel: method,
        event_type: 'manual_log',
        direction: 'outbound',
        summary: notes,
        linked_entity_type: entityType,
        linked_entity_id: entity.id,
        store_id: entityType === 'store' ? entity.id : null,
        user_id: user.id,
      }));

      const { error: commError } = await supabase
        .from('communication_events')
        .insert(communications);

      if (commError) throw commError;

      // Create reminders if follow-up date is provided
      if (followUpDate) {
        const reminders = selectedEntities.map(entity => {
          const reminderData: any = {
            assigned_to: user.id,
            follow_up_date: followUpDate,
            notes: `Follow-up for: ${notes.substring(0, 100)}`,
          };

          if (entityType === 'store') reminderData.store_id = entity.id;
          else if (entityType === 'wholesaler') reminderData.wholesaler_id = entity.id;
          else if (entityType === 'influencer') reminderData.influencer_id = entity.id;

          return reminderData;
        });

        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminders);

        if (reminderError) throw reminderError;
      }

      toast({
        title: "Success",
        description: `Logged communication for ${selectedEntities.length} ${entityType}(s)`,
      });

      setSelectedEntities([]);
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

  const toggleEntity = (entity: { id: string; name: string }) => {
    setSelectedEntities(prev => 
      prev.find(e => e.id === entity.id)
        ? prev.filter(e => e.id !== entity.id)
        : [...prev, entity]
    );
  };

  const removeEntity = (entityId: string) => {
    setSelectedEntities(prev => prev.filter(e => e.id !== entityId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Communication Log</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Tabs value={entityType} onValueChange={(v) => {
              setEntityType(v as 'store' | 'wholesaler' | 'influencer');
              setSelectedEntities([]);
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="store">Stores</TabsTrigger>
                <TabsTrigger value="wholesaler">Wholesalers</TabsTrigger>
                <TabsTrigger value="influencer">Influencers</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label>Select {entityType === 'store' ? 'Stores' : entityType === 'wholesaler' ? 'Wholesalers' : 'Influencers'}</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedEntities.length > 0
                    ? `${selectedEntities.length} ${entityType}(s) selected`
                    : `Select ${entityType}s...`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder={`Search ${entityType}s...`} />
                  <CommandEmpty>No {entityType}s found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {entities?.map((entity) => (
                      <CommandItem
                        key={entity.id}
                        onSelect={() => toggleEntity(entity)}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedEntities.some(e => e.id === entity.id)}
                            onChange={() => toggleEntity(entity)}
                            className="h-4 w-4"
                          />
                          <span>{entity.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedEntities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedEntities.map(entity => (
                  <Badge key={entity.id} variant="secondary" className="gap-1">
                    {entity.name}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeEntity(entity.id)}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk-notes">Notes</Label>
              <TemplateSelector 
                category={entityType} 
                onSelect={(template) => setNotes(template)} 
              />
            </div>
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