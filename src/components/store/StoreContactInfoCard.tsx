import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MapPin, Phone, Mail, MessageSquare, Edit, Building, Plus, X, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type StickerStatus = 'none' | 'doorOnly' | 'inStoreOnly' | 'doorAndInStore';

const STICKER_STATUS_OPTIONS: StickerStatus[] = ['none', 'doorOnly', 'inStoreOnly', 'doorAndInStore'];

const STICKER_STATUS_LABELS: Record<StickerStatus, string> = {
  none: 'No Sticker',
  doorOnly: 'Door Sticker',
  inStoreOnly: 'In-Store Sticker',
  doorAndInStore: 'Door & In-Store',
};

const isStickerStatus = (value: unknown): value is StickerStatus =>
  typeof value === 'string' && STICKER_STATUS_OPTIONS.includes(value as StickerStatus);

const deriveStickerStatus = (door: boolean, instore: boolean): StickerStatus => {
  if (door && instore) return 'doorAndInStore';
  if (door) return 'doorOnly';
  if (instore) return 'inStoreOnly';
  return 'none';
};

interface Store {
  id: string;
  name: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  alt_phone: string;
  email: string;
  primary_contact_name: string | null;
  tags: string[] | null;
  sticker_status: StickerStatus | null;
  sticker_door: boolean | null;
  sticker_instore: boolean | null;
  sticker_phone: boolean | null;
  sticker_taken_down: boolean | null;
  sticker_taken_down_at?: string | null;
}

interface StoreContactInfoCardProps {
  store: Store;
  onUpdate: () => void;
}

type ContactFormData = {
  phone: string;
  alt_phone: string;
  email: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  tags: string[];
  sticker_status: StickerStatus;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  sticker_taken_down: boolean;
};

const createInitialFormData = (store: Store): ContactFormData => ({
  phone: store.phone || '',
  alt_phone: store.alt_phone || '',
  email: store.email || '',
  address_street: store.address_street || '',
  address_city: store.address_city || '',
  address_state: store.address_state || '',
  address_zip: store.address_zip || '',
  tags: store.tags ?? [],
  sticker_door: Boolean(store.sticker_door),
  sticker_instore: Boolean(store.sticker_instore),
  sticker_phone: Boolean(store.sticker_phone),
  sticker_taken_down: Boolean(store.sticker_taken_down),
  sticker_status: isStickerStatus(store.sticker_status)
    ? store.sticker_status
    : deriveStickerStatus(Boolean(store.sticker_door), Boolean(store.sticker_instore)),
});

export function StoreContactInfoCard({ store, onUpdate }: StoreContactInfoCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(() => createInitialFormData(store));
  const [newTag, setNewTag] = useState('');
  type StoreContact = {
    id: string;
    name: string;
    role: string | null;
    is_primary: boolean | null;
    phone: string | null;
    can_receive_sms: boolean | null;
    email: string | null;
  };
  const {
    data: contacts,
    isLoading: contactsLoading,
  } = useQuery({
    queryKey: ['store-owner', store.id],
    queryFn: async (): Promise<StoreContact[]> => {
      const { data, error } = await supabase
        .from('store_contacts')
        .select('id, name, role, is_primary, phone, can_receive_sms, email')
        .eq('store_id', store.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching store owners:', error);
        throw error;
      }

      return data ?? [];
    },
    enabled: !!store.id,
  });
  const contactList = contacts ?? [];
  const ownerContact =
    contactList.find((contact) => contact.role?.toLowerCase().includes('owner')) ??
    contactList.find((contact) => contact.is_primary) ??
    null;
  const ownerName = ownerContact?.name || store.primary_contact_name || '';
  const stickerToggleConfigs: Array<{
    key: keyof Pick<ContactFormData, 'sticker_door' | 'sticker_instore' | 'sticker_phone'>;
    label: string;
  }> = [
    { key: 'sticker_door', label: 'Door Sticker' },
    { key: 'sticker_instore', label: 'In-Store Sticker' },
    { key: 'sticker_phone', label: 'Phone Sticker' },
  ];

  useEffect(() => {
    if (!editOpen) return;

    setFormData(createInitialFormData(store));
    setNewTag('');
  }, [store, editOpen]);

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;

    setFormData((prev) => {
      const hasTag = prev.tags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase());
      if (hasTag) {
        return prev;
      }

      return {
        ...prev,
        tags: [...prev.tags, trimmed],
      };
    });

    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleStickerToggle = (
    field: 'sticker_door' | 'sticker_instore' | 'sticker_phone',
    value: boolean
  ) => {
    setFormData((prev) => {
      const next: ContactFormData = { ...prev, [field]: value };
      if (field === 'sticker_door' || field === 'sticker_instore') {
        next.sticker_status = deriveStickerStatus(
          field === 'sticker_door' ? value : next.sticker_door,
          field === 'sticker_instore' ? value : next.sticker_instore
        );
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const stickerStatus = deriveStickerStatus(formData.sticker_door, formData.sticker_instore);
      const updates: Record<string, unknown> = {
        phone: formData.phone || null,
        alt_phone: formData.alt_phone || null,
        email: formData.email || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        tags: formData.tags,
        sticker_status: stickerStatus,
        sticker_door: formData.sticker_door,
        sticker_instore: formData.sticker_instore,
        sticker_phone: formData.sticker_phone,
        sticker_taken_down: formData.sticker_taken_down,
      };

      if (store.sticker_taken_down !== formData.sticker_taken_down) {
        updates.sticker_taken_down_at = formData.sticker_taken_down ? new Date().toISOString() : null;
      }

      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;

      toast.success('Contact information updated');
      setEditOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating store:', error);
      toast.error('Failed to update contact information');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Contact Information
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Contact Info
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Owner</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <p className="text-sm">
                {contactsLoading ? 'Loading owner...' : ownerName || 'No owner on file'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Key Contacts */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Key Contacts</p>
            {contactsLoading ? (
              <p className="text-sm text-muted-foreground">Loading contacts...</p>
            ) : contactList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet</p>
            ) : (
              <div className="space-y-2">
                {contactList.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/20 p-3"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{contact.name}</span>
                        {contact.is_primary && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Primary
                          </Badge>
                        )}
                        {contact.role && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 capitalize">
                            {contact.role.replace(/[_\s]+/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {contact.phone ? (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            No phone
                          </span>
                        )}
                        {contact.can_receive_sms && contact.phone && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            SMS Enabled
                          </span>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Address */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Address</p>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5" />
              <div className="text-sm">
                <p>{store.address_street || 'No street address'}</p>
                <p>{[store.address_city, store.address_state, store.address_zip].filter(Boolean).join(', ') || 'No city/state'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Phone Numbers - Clearly Separated */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Phone Numbers</p>
            
            {/* Store Phone (Call Only) */}
            {store.phone ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <a href={`tel:${store.phone}`} className="text-sm font-medium hover:underline">
                      {store.phone}
                    </a>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Store Telephone
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-500/30">
                        Call Only
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`tel:${store.phone}`} aria-label={`Call ${store.name}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No store phone</p>
            )}

            {/* Alt Phone (Cell - Text Enabled) */}
            {store.alt_phone && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <a href={`tel:${store.alt_phone}`} className="text-sm font-medium hover:underline">
                      {store.alt_phone}
                    </a>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Cell Phone
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/30">
                        Text Enabled
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`tel:${store.alt_phone}`} aria-label={`Call ${store.name} cell`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`sms:${store.alt_phone}`} aria-label={`Text ${store.name}`}>
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          {store.email && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href={`mailto:${store.email}`} className="text-sm hover:underline">
                  {store.email}
                </a>
              </div>
            </>
          )}

          {/* Tags */}
          {store.tags && store.tags.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {store.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Contact Information</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label>Store Telephone (Call Only)</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label>Cell Phone (Text Enabled)</Label>
              <Input
                value={formData.alt_phone}
                onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                placeholder="(555) 987-6543"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="store@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Store Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Type a tag and press Enter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="flex items-center gap-1 text-xs">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags added yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Sticker Status</Label>
                <Badge variant="outline" className="text-xs">
                  {STICKER_STATUS_LABELS[formData.sticker_status]}
                </Badge>
              </div>
              <div className="rounded-lg border border-border/40 p-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {stickerToggleConfigs.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span>{label}</span>
                      <Switch
                        id={`${key}-toggle`}
                        checked={formData[key]}
                        onCheckedChange={(checked) => handleStickerToggle(key, checked)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-destructive/5 px-3 py-2 text-sm">
                  <span>Sticker Taken Down</span>
                  <Switch
                    id="sticker-taken-down-toggle"
                    checked={formData.sticker_taken_down}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        sticker_taken_down: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                value={formData.address_street}
                onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  placeholder="NY"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={formData.address_zip}
                onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                placeholder="10001"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}