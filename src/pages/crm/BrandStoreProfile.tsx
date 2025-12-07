import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, MapPin, Phone, User, Building2, 
  Sticker, Plus, Clock, CheckCircle2, XCircle,
  Send, Trash2
} from "lucide-react";
import { useStoreNotes, useAddStoreNote, useDeleteStoreNote } from "@/hooks/useStoreNotes";
import { useStoreStatusHistory, useAddStoreStatusEvent } from "@/hooks/useStoreStatusHistory";
import { format } from "date-fns";

export default function BrandStoreProfile() {
  const { brandId, storeId } = useParams<{ brandId: string; storeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  // Fetch store details
  const { data: store, isLoading } = useQuery({
    queryKey: ["store-profile", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_master")
        .select(`
          *,
          borough:boroughs(id, name),
          brand:brands(id, name, color)
        `)
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Fetch notes
  const { data: notes = [] } = useStoreNotes(storeId);
  const addNote = useAddStoreNote();
  const deleteNote = useDeleteStoreNote();

  // Fetch status history
  const { data: statusHistory = [] } = useStoreStatusHistory(storeId);
  const addStatusEvent = useAddStoreStatusEvent();

  // Fetch linked contacts
  const { data: linkedContacts = [] } = useQuery({
    queryKey: ["store-contacts", storeId, brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select(`
          *,
          role:customer_roles(id, role_name)
        `)
        .eq("business_id", brandId)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Update sticker fields
  const updateSticker = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      const { error } = await supabase
        .from("store_master")
        .update({ [field]: value })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-profile", storeId] });
      toast.success("Sticker status updated");
      addStatusEvent.mutate({
        storeId: storeId!,
        eventType: "Sticker Check",
        description: "Sticker status updated",
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleAddNote = async () => {
    if (!newNote.trim() || !storeId) return;
    await addNote.mutateAsync({ storeId, noteText: newNote.trim() });
    setNewNote("");
    addStatusEvent.mutate({
      storeId,
      eventType: "Note Added",
      description: "New note added to store",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Store not found</p>
            <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandColor = (store as any).brand?.color || "#6366f1";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div 
        className="rounded-xl p-6 text-white"
        style={{ backgroundColor: brandColor }}
      >
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20"
            onClick={() => navigate(`/crm/brand/${brandId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm text-white/80">{(store as any).brand?.name || "Brand"}</p>
            <h1 className="text-2xl font-bold">{store.store_name}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Store Info & Stickers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Owner</Label>
                  <p className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4" />
                    {store.owner_name || "Not specified"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4" />
                    {store.phone || "Not specified"}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4" />
                    {store.address || "Not specified"}
                    {store.city && `, ${store.city}`}
                    {store.state && ` ${store.state}`}
                    {store.zip && ` ${store.zip}`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Borough</Label>
                  <p className="mt-1">
                    <Badge variant="secondary">{(store as any).borough?.name || "Not assigned"}</Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sticker Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sticker className="h-5 w-5" />
                Sticker Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {store.sticker_on_door ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>Sticker on Door</span>
                </div>
                <Switch
                  checked={store.sticker_on_door || false}
                  onCheckedChange={(checked) => 
                    updateSticker.mutate({ field: "sticker_on_door", value: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {store.sticker_in_store ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>Sticker Inside Store</span>
                </div>
                <Switch
                  checked={store.sticker_in_store || false}
                  onCheckedChange={(checked) => 
                    updateSticker.mutate({ field: "sticker_in_store", value: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {store.sticker_with_phone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>Sticker with Phone Number</span>
                </div>
                <Switch
                  checked={store.sticker_with_phone || false}
                  onCheckedChange={(checked) => 
                    updateSticker.mutate({ field: "sticker_with_phone", value: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Store Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Store Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this store..."
                  rows={2}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddNote} 
                  disabled={!newNote.trim() || addNote.isPending}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {notes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-muted/50 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <p className="text-sm">{note.note_text}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteNote.mutate({ noteId: note.id, storeId: storeId! })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Contacts & History */}
        <div className="space-y-6">
          {/* Linked Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts linked</p>
              ) : (
                <div className="space-y-3">
                  {linkedContacts.slice(0, 5).map((contact: any) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                      onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{contact.full_name}</p>
                        {contact.role?.role_name && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {contact.role.role_name}
                          </Badge>
                        )}
                      </div>
                      {contact.phone && (
                        <span className="text-xs text-muted-foreground">{contact.phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded</p>
              ) : (
                <div className="space-y-3">
                  {statusHistory.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex-shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{event.event_type}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(event.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
