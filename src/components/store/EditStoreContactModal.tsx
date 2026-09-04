import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StoreContact {
  id: string;
  store_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean | null;
  can_receive_sms: boolean | null;
  influence_level: string | null;
  notes: string | null;
  responsive_by_call: boolean | null;
  responsive_by_text: boolean | null;
  shirt_size?: string | null;
  gift_request?: string | null;
}

interface EditStoreContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: StoreContact | null;
  onSuccess: () => void;
}

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'WORKER', label: 'Worker' },
  { value: 'OWNER_SON', label: "Owner's Son" },
  { value: 'OWNER_BROTHER', label: "Owner's Brother" },
  { value: 'OWNER_COUSIN', label: "Owner's Cousin" },
  { value: 'OWNER_NEPHEW', label: "Owner's Nephew" },
  { value: 'OWNER_UNCLE', label: "Owner's Uncle" },
  { value: 'OTHER', label: 'Other' },
];

const INFLUENCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function EditStoreContactModal({ open, onOpenChange, contact, onSuccess }: EditStoreContactModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    is_primary: false,
    can_receive_sms: false,
    influence_level: '',
    notes: '',
    responsive_by_call: false,
    responsive_by_text: false,
    shirt_size: '',
    gift_request: '',
  });

  useEffect(() => {
    if (contact && open) {
      setFormData({
        name: contact.name || '',
        role: contact.role || '',
        phone: contact.phone || '',
        email: contact.email || '',
        is_primary: contact.is_primary || false,
        can_receive_sms: contact.can_receive_sms || false,
        influence_level: contact.influence_level || '',
        notes: contact.notes || '',
        responsive_by_call: contact.responsive_by_call || false,
        responsive_by_text: contact.responsive_by_text || false,
        shirt_size: contact.shirt_size || '',
        gift_request: contact.gift_request || '',
      });
    }
  }, [contact, open]);

  const handleSave = async () => {
    if (!contact) return;
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_contacts')
        .update({
          name: formData.name.trim(),
          role: formData.role || null,
          phone: formData.phone || null,
          email: formData.email || null,
          is_primary: formData.is_primary,
          can_receive_sms: formData.can_receive_sms,
          influence_level: formData.influence_level || null,
          notes: formData.notes || null,
          responsive_by_call: formData.responsive_by_call,
          responsive_by_text: formData.responsive_by_text,
          shirt_size: formData.shirt_size.trim() || null,
          gift_request: formData.gift_request.trim() || null,
        })
        .eq('id', contact.id);

      if (error) throw error;

      toast.success('Contact updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    if (!confirm('Are you sure you want to delete this contact?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      toast.success('Contact deleted');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contact name"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="contact@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Influence Level</Label>
            <Select
              value={formData.influence_level}
              onValueChange={(value) => setFormData({ ...formData, influence_level: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select influence level" />
              </SelectTrigger>
              <SelectContent>
                {INFLUENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Shirt Size</Label>
            <Input
              value={formData.shirt_size}
              onChange={(e) => setFormData({ ...formData, shirt_size: e.target.value })}
              placeholder="e.g. XL"
            />
          </div>

          <div className="space-y-2">
            <Label>Gift / Request</Label>
            <Textarea
              value={formData.gift_request}
              onChange={(e) => setFormData({ ...formData, gift_request: e.target.value })}
              placeholder="What this person asked for (hat, hoodie, lighter…)"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this contact..."
              rows={3}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
              <Label htmlFor="is_primary" className="cursor-pointer">Primary Contact</Label>
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
              <Label htmlFor="can_receive_sms" className="cursor-pointer">Can Receive SMS</Label>
              <Switch
                id="can_receive_sms"
                checked={formData.can_receive_sms}
                onCheckedChange={(checked) => setFormData({ ...formData, can_receive_sms: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
              <Label htmlFor="responsive_by_call" className="cursor-pointer">Responsive by Call</Label>
              <Switch
                id="responsive_by_call"
                checked={formData.responsive_by_call}
                onCheckedChange={(checked) => setFormData({ ...formData, responsive_by_call: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
              <Label htmlFor="responsive_by_text" className="cursor-pointer">Responsive by Text</Label>
              <Switch
                id="responsive_by_text"
                checked={formData.responsive_by_text}
                onCheckedChange={(checked) => setFormData({ ...formData, responsive_by_text: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button variant="destructive" onClick={handleDelete} disabled={saving} className="sm:mr-auto">
            Delete Contact
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
