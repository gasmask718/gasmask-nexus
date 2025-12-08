// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER FORM MODAL — Add/Edit Supplier
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupplierFormModalProps {
  open: boolean;
  onClose: () => void;
  supplierId?: string | null;
}

interface SupplierForm {
  name: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  wechat: string;
  payment_terms: string;
  lead_time_days: string;
  reliability_score: string;
  notes: string;
  status: string;
}

const initialForm: SupplierForm = {
  name: '',
  country: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  wechat: '',
  payment_terms: '',
  lead_time_days: '',
  reliability_score: '',
  notes: '',
  status: 'active',
};

export default function SupplierFormModal({ open, onClose, supplierId }: SupplierFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SupplierForm>(initialForm);
  const isEdit = !!supplierId;

  // Fetch existing supplier for edit mode
  const { data: existingSupplier } = useQuery({
    queryKey: ['supplier-edit', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId && open,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingSupplier) {
      setForm({
        name: existingSupplier.name || '',
        country: existingSupplier.country || '',
        contact_name: existingSupplier.contact_name || '',
        contact_email: existingSupplier.contact_email || '',
        contact_phone: existingSupplier.contact_phone || '',
        wechat: existingSupplier.wechat || '',
        payment_terms: existingSupplier.payment_terms || '',
        lead_time_days: existingSupplier.lead_time_days?.toString() || '',
        reliability_score: existingSupplier.reliability_score?.toString() || '',
        notes: existingSupplier.notes || '',
        status: existingSupplier.status || 'active',
      });
    } else if (!supplierId) {
      setForm(initialForm);
    }
  }, [existingSupplier, supplierId]);

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setForm(initialForm);
    }
  }, [open]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        country: form.country || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        wechat: form.wechat || null,
        payment_terms: form.payment_terms || null,
        lead_time_days: form.lead_time_days ? parseInt(form.lead_time_days) : null,
        reliability_score: form.reliability_score ? parseFloat(form.reliability_score) : null,
        notes: form.notes || null,
        status: form.status,
      };

      if (isEdit && supplierId) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', supplierId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-supplier', supplierId] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(isEdit ? 'Supplier updated' : 'Supplier added');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save supplier: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Basic Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Supplier Co."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="China"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label>Active</Label>
              <Switch
                checked={form.status === 'active'}
                onCheckedChange={(checked) =>
                  setForm({ ...form, status: checked ? 'active' : 'inactive' })
                }
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Contact Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="john@supplier.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="+1 555-1234"
                />
              </div>
              <div className="space-y-2">
                <Label>WeChat</Label>
                <Input
                  value={form.wechat}
                  onChange={(e) => setForm({ ...form, wechat: e.target.value })}
                  placeholder="wechat_id"
                />
              </div>
            </div>
          </div>

          {/* Commercial Terms */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Commercial Terms
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  placeholder="Net 30"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Lead Time (days)</Label>
                <Input
                  type="number"
                  value={form.lead_time_days}
                  onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
                  placeholder="14"
                />
              </div>
            </div>
          </div>

          {/* Other */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Other
            </h3>
            <div className="space-y-2">
              <Label>Rating (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.reliability_score}
                onChange={(e) => setForm({ ...form, reliability_score: e.target.value })}
                placeholder="0-100"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes about this supplier..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
