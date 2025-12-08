import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  contact_phone: z.string().optional(),
  capacity: z.coerce.number().optional(),
  is_active: z.boolean().default(true),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

interface WarehouseFormModalProps {
  open: boolean;
  onClose: () => void;
  warehouseId?: string | null;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

const WAREHOUSE_TYPES = ['central', 'distribution', 'fulfillment', 'retail', 'cold-storage'];

export default function WarehouseFormModal({ open, onClose, warehouseId }: WarehouseFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!warehouseId;

  const { data: existingWarehouse } = useQuery({
    queryKey: ['warehouse-form', warehouseId],
    queryFn: async () => {
      if (!warehouseId) return null;
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!warehouseId && open,
  });

  const form = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '',
      code: '',
      type: 'central',
      is_active: true,
    },
  });

  useEffect(() => {
    if (existingWarehouse) {
      form.reset({
        name: existingWarehouse.name || '',
        code: existingWarehouse.code || '',
        type: existingWarehouse.type || 'central',
        address_line1: existingWarehouse.address_line1 || '',
        address_line2: existingWarehouse.address_line2 || '',
        city: existingWarehouse.city || '',
        state: existingWarehouse.state || '',
        zip: existingWarehouse.zip || '',
        country: existingWarehouse.country || '',
        timezone: existingWarehouse.timezone || '',
        contact_phone: existingWarehouse.contact_phone || '',
        capacity: existingWarehouse.capacity || undefined,
        is_active: existingWarehouse.is_active ?? true,
      });
    } else if (!warehouseId) {
      form.reset({
        name: '',
        code: '',
        type: 'central',
        is_active: true,
      });
    }
  }, [existingWarehouse, warehouseId, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: WarehouseFormData) => {
      if (isEdit) {
        const { error } = await supabase
          .from('warehouses')
          .update({
            name: data.name,
            code: data.code,
            type: data.type || null,
            address_line1: data.address_line1 || null,
            address_line2: data.address_line2 || null,
            city: data.city || null,
            state: data.state || null,
            zip: data.zip || null,
            country: data.country || null,
            timezone: data.timezone || null,
            contact_phone: data.contact_phone || null,
            capacity: data.capacity || null,
            is_active: data.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', warehouseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('warehouses').insert({
          name: data.name,
          code: data.code,
          type: data.type || null,
          address_line1: data.address_line1 || null,
          address_line2: data.address_line2 || null,
          city: data.city || null,
          state: data.state || null,
          zip: data.zip || null,
          country: data.country || null,
          timezone: data.timezone || null,
          contact_phone: data.contact_phone || null,
          capacity: data.capacity || null,
          is_active: data.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses-list'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-detail', warehouseId] });
      toast.success(isEdit ? 'Warehouse updated' : 'Warehouse created');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save warehouse');
    },
  });

  const onSubmit = (data: WarehouseFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Warehouse' : 'Add Warehouse'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Basic Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...form.register('name')} placeholder="Main Warehouse" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input id="code" {...form.register('code')} placeholder="NYC-MAIN" />
                {form.formState.errors.code && (
                  <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.watch('type') || 'central'}
                  onValueChange={(val) => form.setValue('type', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch
                  id="is_active"
                  checked={form.watch('is_active')}
                  onCheckedChange={(checked) => form.setValue('is_active', checked)}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Location</h3>
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input id="address_line1" {...form.register('address_line1')} placeholder="123 Main St" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input id="address_line2" {...form.register('address_line2')} placeholder="Suite 100" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...form.register('city')} placeholder="New York" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...form.register('state')} placeholder="NY" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Postal Code</Label>
                <Input id="zip" {...form.register('zip')} placeholder="10001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...form.register('country')} placeholder="USA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={form.watch('timezone') || ''}
                  onValueChange={(val) => form.setValue('timezone', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Capacity & Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Capacity & Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (units)</Label>
                <Input
                  id="capacity"
                  type="number"
                  {...form.register('capacity')}
                  placeholder="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input id="contact_phone" {...form.register('contact_phone')} placeholder="+1 555-123-4567" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
