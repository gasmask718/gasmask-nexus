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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const binSchema = z.object({
  bin_code: z.string().min(1, 'Bin code is required'),
  description: z.string().optional(),
  aisle: z.string().optional(),
  shelf: z.string().optional(),
  max_weight: z.coerce.number().optional(),
});

type BinFormData = z.infer<typeof binSchema>;

interface BinFormModalProps {
  open: boolean;
  onClose: () => void;
  warehouseId: string;
  binId?: string | null;
}

export default function BinFormModal({ open, onClose, warehouseId, binId }: BinFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!binId;

  const { data: existingBin } = useQuery({
    queryKey: ['bin-form', binId],
    queryFn: async () => {
      if (!binId) return null;
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .eq('id', binId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!binId && open,
  });

  const form = useForm<BinFormData>({
    resolver: zodResolver(binSchema),
    defaultValues: {
      bin_code: '',
      description: '',
      aisle: '',
      shelf: '',
    },
  });

  useEffect(() => {
    if (existingBin) {
      form.reset({
        bin_code: existingBin.bin_code || '',
        description: existingBin.description || '',
        aisle: existingBin.aisle || '',
        shelf: existingBin.shelf || '',
        max_weight: existingBin.max_weight ? Number(existingBin.max_weight) : undefined,
      });
    } else if (!binId) {
      form.reset({
        bin_code: '',
        description: '',
        aisle: '',
        shelf: '',
      });
    }
  }, [existingBin, binId, form, open]);

  const mutation = useMutation({
    mutationFn: async (data: BinFormData) => {
      if (isEdit) {
        const { error } = await supabase
          .from('warehouse_bins')
          .update({
            bin_code: data.bin_code,
            description: data.description || null,
            aisle: data.aisle || null,
            shelf: data.shelf || null,
            max_weight: data.max_weight || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', binId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('warehouse_bins').insert({
          warehouse_id: warehouseId,
          bin_code: data.bin_code,
          description: data.description || null,
          aisle: data.aisle || null,
          shelf: data.shelf || null,
          max_weight: data.max_weight || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-bins', warehouseId] });
      toast.success(isEdit ? 'Bin updated' : 'Bin created');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save bin');
    },
  });

  const onSubmit = (data: BinFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Bin' : 'Add Bin'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bin_code">Bin Code *</Label>
            <Input id="bin_code" {...form.register('bin_code')} placeholder="A-01-03" />
            {form.formState.errors.bin_code && (
              <p className="text-sm text-destructive">{form.formState.errors.bin_code.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Input id="aisle" {...form.register('aisle')} placeholder="A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shelf">Shelf</Label>
              <Input id="shelf" {...form.register('shelf')} placeholder="01" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_weight">Max Weight (lbs)</Label>
            <Input
              id="max_weight"
              type="number"
              {...form.register('max_weight')}
              placeholder="500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} placeholder="Notes about this bin..." />
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
