import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Phone, Star } from 'lucide-react';

interface AddContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
  onSuccess: () => void;
}

const RELATIONSHIP_TYPES = [
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

export function AddContactModal({
  open,
  onOpenChange,
  storeId,
  storeName,
  onSuccess,
}: AddContactModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'WORKER',
    is_primary: false,
    can_receive_sms: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // If marking as primary, unset other primary contacts first
      if (formData.is_primary) {
        await supabase
          .from('store_contacts')
          .update({ is_primary: false })
          .eq('store_id', storeId);
      }

      const { error } = await supabase.from('store_contacts').insert({
        store_id: storeId,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        role: formData.role,
        is_primary: formData.is_primary,
        can_receive_sms: formData.can_receive_sms,
      });

      if (error) throw error;

      toast.success(`Contact "${formData.name}" added to ${storeName}`);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        role: 'WORKER',
        is_primary: false,
        can_receive_sms: true,
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error adding contact:', error);
      toast.error('Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add Contact to {storeName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="Enter contact name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                className="pl-10"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role at Store</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_primary" className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Primary Contact
                </Label>
                <p className="text-xs text-muted-foreground">
                  Main person to reach out to
                </p>
              </div>
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_primary: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="can_receive_sms">Can Receive SMS</Label>
                <p className="text-xs text-muted-foreground">
                  Include in text broadcasts
                </p>
              </div>
              <Switch
                id="can_receive_sms"
                checked={formData.can_receive_sms}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, can_receive_sms: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
