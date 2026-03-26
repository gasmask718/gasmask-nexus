import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, DollarSign, Clock, Users, ListChecks } from 'lucide-react';
import { usePartnerServices, useUpsertService } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTPartnerServices({ partnerId }: Props) {
  const { data: services = [] } = usePartnerServices(partnerId);
  const upsert = useUpsertService();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    upsert.mutate({ ...form, partner_id: partnerId }, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Services ({services.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input value={form.service_name || ''} onChange={e => update('service_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description || ''} onChange={e => update('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Price ($)</Label>
                  <Input type="number" value={form.base_price || ''} onChange={e => update('base_price', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Price Type</Label>
                  <Select value={form.price_type || 'flat'} onValueChange={v => update('price_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="per_hour">Per Hour</SelectItem>
                      <SelectItem value="per_guest">Per Guest</SelectItem>
                      <SelectItem value="per_item">Per Item</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Input type="number" value={form.duration_hours || ''} onChange={e => update('duration_hours', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={form.category || ''} onChange={e => update('category', e.target.value)} />
                </div>
              </div>
              <Button onClick={save} disabled={upsert.isPending} className="w-full">Save Service</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {services.map(svc => (
          <Card key={svc.id} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-sm">{svc.service_name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{svc.description}</p>
                </div>
                <Badge variant={svc.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {svc.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                {svc.base_price && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> ${Number(svc.base_price).toFixed(0)} / {svc.price_type}
                  </span>
                )}
                {svc.duration_hours && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {svc.duration_hours}h</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
