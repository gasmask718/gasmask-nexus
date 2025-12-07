import { useState } from 'react';
import { useBusinessStore } from '@/stores/businessStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { BoroughSelector } from './BoroughSelector';

interface QuickAddContactFormProps {
  onSuccess?: () => void;
}

export const QuickAddContactForm = ({ onSuccess }: QuickAddContactFormProps) => {
  const { selectedBusiness } = useBusinessStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'lead' as string,
    borough_id: '' as string,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('crm_contacts').insert({
        business_id: selectedBusiness.id,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        type: formData.type,
        borough_id: formData.borough_id || null,
        relationship_status: 'active',
        last_contact_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Contact Added',
        description: `${formData.name} has been added to your CRM.`,
      });

      setFormData({ name: '', email: '', phone: '', type: 'lead', borough_id: '' });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter contact name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="contact@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+1-555-1234"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="store">Store</SelectItem>
            <SelectItem value="driver">Driver</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <BoroughSelector
        value={formData.borough_id}
        onChange={(value) => setFormData({ ...formData, borough_id: value })}
        businessId={selectedBusiness?.id}
      />

      <Button type="submit" className="w-full" disabled={loading}>
        <Plus className="mr-2 h-4 w-4" />
        {loading ? 'Adding...' : 'Add Contact'}
      </Button>
    </form>
  );
};
