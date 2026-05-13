import { useState } from 'react';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const intakeSchema = z.object({
  business_name: z.string().trim().min(1, 'Business name is required').max(200),
  full_name: z.string().trim().max(150).optional().or(z.literal('')),
  phone_number: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().max(60).optional().or(z.literal('')),
  industry: z.string().trim().max(100).optional().or(z.literal('')),
  service_interest: z.string().trim().max(200).optional().or(z.literal('')),
  call_notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

type IntakeForm = z.infer<typeof intakeSchema>;

const EMPTY: IntakeForm = {
  business_name: '', full_name: '', phone_number: '', email: '',
  city: '', state: '', industry: '', service_interest: '', call_notes: '',
};

interface Props {
  variant?: 'fab' | 'inline' | 'embedded';
  className?: string;
  assignToSelf?: boolean;
  onCreated?: (id: string) => void;
}

export function BrandaroLeadIntakeModal({
  variant = 'fab',
  className,
  assignToSelf = true,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IntakeForm>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async (values: IntakeForm) => {
      const payload: Record<string, any> = {
        business_name: values.business_name.trim(),
        pipeline_stage: 'new',
        lead_status: 'new',
        query_source: 'va_manual_intake',
        priority_tier: 'tier_3',
      };
      if (values.full_name) {
        payload.full_name = values.full_name.trim();
        const parts = values.full_name.trim().split(/\s+/);
        payload.first_name = parts[0];
        if (parts.length > 1) payload.last_name = parts.slice(1).join(' ');
      }
      if (values.phone_number) payload.phone_number = values.phone_number.trim();
      if (values.email) payload.email = values.email.trim().toLowerCase();
      if (values.city) payload.city = values.city.trim();
      if (values.state) payload.state = values.state.trim();
      if (values.industry) payload.industry = values.industry.trim();
      if (values.service_interest) payload.service_interest = values.service_interest.trim();
      if (values.call_notes) payload.call_notes = values.call_notes.trim();
      if (assignToSelf && user?.id) payload.assigned_va = user.id;

      const { data, error } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (data) => {
      toast.success('Lead added to Brandaro pipeline');
      qc.invalidateQueries({ queryKey: ['brandaro-qualified-leads'] });
      qc.invalidateQueries({ queryKey: ['brandaro-leads'] });
      qc.invalidateQueries({ queryKey: ['brandaro-hot-leads'] });
      qc.invalidateQueries({ queryKey: ['va-leads'] });
      setForm(EMPTY);
      setErrors({});
      setOpen(false);
      onCreated?.(data.id);
    },
    onError: (err: any) => {
      toast.error(`Failed to add lead: ${err.message || 'unknown error'}`);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = intakeSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path.join('.')] = issue.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  const setField = <K extends keyof IntakeForm>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const trigger = variant === 'fab' ? (
    <Button
      className={cn(
        'fixed bottom-6 right-6 h-14 rounded-full shadow-2xl gap-2 z-[100] min-w-14',
        'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white',
        className,
      )}
    >
      <UserPlus className="h-5 w-5" />
      <span className="hidden sm:inline font-semibold">New Lead Intake</span>
    </Button>
  ) : (
    <Button size="sm" className={cn('gap-2', className)}>
      <Plus className="h-4 w-4" /> New Lead Intake
    </Button>
  );

  // Embedded variant — renders the form inline (no dialog, no trigger).
  // Used by the VA Dashboard "Intake" tab so the form lives as a full surface
  // instead of behind a floating bubble.
  if (variant === 'embedded') {
    return (
      <div className={cn('rounded-xl border border-slate-700 bg-slate-900/40 p-5', className)}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-400" /> New Lead Intake
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Capture a new prospect into the Brandaro pipeline. Saves to{' '}
            <code className="text-[10px]">brandaro_qualified_leads</code>
            {assignToSelf ? ' and assigns it to you.' : '.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) => setField('business_name', e.target.value)}
              placeholder="Acme Corp"
              maxLength={200}
              autoFocus
            />
            {errors.business_name && <p className="text-xs text-destructive mt-1">{errors.business_name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Contact Name</Label>
              <Input id="full_name" value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)} placeholder="Jane Doe" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone</Label>
              <Input id="phone_number" type="tel" value={form.phone_number}
                onChange={(e) => setField('phone_number', e.target.value)} placeholder="+1 555 123 4567" maxLength={40} />
              {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number}</p>}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email}
                onChange={(e) => setField('email', e.target.value)} placeholder="contact@business.com" maxLength={255} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city}
                onChange={(e) => setField('city', e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state}
                onChange={(e) => setField('state', e.target.value)} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry}
                onChange={(e) => setField('industry', e.target.value)} placeholder="Restaurant, Retail, etc."
                maxLength={100} />
            </div>
            <div>
              <Label htmlFor="service_interest">Service Interest</Label>
              <Input id="service_interest" value={form.service_interest}
                onChange={(e) => setField('service_interest', e.target.value)}
                placeholder="Web design, AI, branding..." maxLength={200} />
            </div>
          </div>

          <div>
            <Label htmlFor="call_notes">Notes</Label>
            <Textarea id="call_notes" value={form.call_notes} rows={3}
              onChange={(e) => setField('call_notes', e.target.value)}
              placeholder="Source, context, anything useful for the next call..." maxLength={2000} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setForm(EMPTY); setErrors({}); }}
              disabled={create.isPending}
            >
              Reset
            </Button>
            <Button type="submit" disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {create.isPending ? 'Saving...' : 'Add Lead'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-500" /> New Lead Intake
          </DialogTitle>
          <DialogDescription>
            Capture a new prospect into the Brandaro pipeline. Saves to{' '}
            <code className="text-xs">brandaro_qualified_leads</code>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) => setField('business_name', e.target.value)}
              placeholder="Acme Corp"
              maxLength={200}
              autoFocus
            />
            {errors.business_name && <p className="text-xs text-destructive mt-1">{errors.business_name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Contact Name</Label>
              <Input id="full_name" value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)} placeholder="Jane Doe" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone</Label>
              <Input id="phone_number" type="tel" value={form.phone_number}
                onChange={(e) => setField('phone_number', e.target.value)} placeholder="+1 555 123 4567" maxLength={40} />
              {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number}</p>}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email}
                onChange={(e) => setField('email', e.target.value)} placeholder="contact@business.com" maxLength={255} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city}
                onChange={(e) => setField('city', e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state}
                onChange={(e) => setField('state', e.target.value)} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry}
                onChange={(e) => setField('industry', e.target.value)} placeholder="Restaurant, Retail, etc."
                maxLength={100} />
            </div>
            <div>
              <Label htmlFor="service_interest">Service Interest</Label>
              <Input id="service_interest" value={form.service_interest}
                onChange={(e) => setField('service_interest', e.target.value)}
                placeholder="Web design, AI, branding..." maxLength={200} />
            </div>
          </div>

          <div>
            <Label htmlFor="call_notes">Notes</Label>
            <Textarea id="call_notes" value={form.call_notes} rows={3}
              onChange={(e) => setField('call_notes', e.target.value)}
              placeholder="Source, context, anything useful for the next call..." maxLength={2000} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {create.isPending ? 'Saving...' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
