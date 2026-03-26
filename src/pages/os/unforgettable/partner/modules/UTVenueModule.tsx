import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Building2, Users, Car, Accessibility, DollarSign } from 'lucide-react';
import { useVenueSpaces, useUpsertVenueSpace } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

export default function UTVenueModule({ partnerId }: Props) {
  const { data: spaces = [] } = useVenueSpaces(partnerId);
  const upsert = useUpsertVenueSpace();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const save = () => {
    upsert.mutate({ ...form, partner_id: partnerId }, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Venue Spaces
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage rooms, halls, and rentable spaces</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Space</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Venue Space</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Space Name</Label>
                <Input value={form.space_name || ''} onChange={e => update('space_name', e.target.value)} placeholder="e.g. Grand Ballroom" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description || ''} onChange={e => update('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Seated Capacity</Label>
                  <Input type="number" value={form.capacity_seated || ''} onChange={e => update('capacity_seated', parseInt(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Standing</Label>
                  <Input type="number" value={form.capacity_standing || ''} onChange={e => update('capacity_standing', parseInt(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Sq Ft</Label>
                  <Input type="number" value={form.square_footage || ''} onChange={e => update('square_footage', parseInt(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input type="number" value={form.hourly_rate || ''} onChange={e => update('hourly_rate', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Half-Day ($)</Label>
                  <Input type="number" value={form.half_day_rate || ''} onChange={e => update('half_day_rate', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Full-Day ($)</Label>
                  <Input type="number" value={form.full_day_rate || ''} onChange={e => update('full_day_rate', parseFloat(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Hours</Label>
                  <Input type="number" value={form.minimum_hours || 4} onChange={e => update('minimum_hours', parseInt(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Parking Capacity</Label>
                  <Input type="number" value={form.parking_capacity || ''} onChange={e => update('parking_capacity', parseInt(e.target.value))} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Outside Catering Allowed</Label>
                  <Switch checked={form.outside_catering_allowed ?? true} onCheckedChange={v => update('outside_catering_allowed', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Valet Available</Label>
                  <Switch checked={form.valet_available ?? false} onCheckedChange={v => update('valet_available', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Wheelchair Accessible</Label>
                  <Switch checked={form.wheelchair_accessible ?? true} onCheckedChange={v => update('wheelchair_accessible', v)} />
                </div>
              </div>
              <Button onClick={save} disabled={upsert.isPending} className="w-full">Save Space</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {spaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No spaces added yet. Add your first rentable space.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {spaces.map(space => (
            <Card key={space.id} className="border-border/50">
              <CardContent className="pt-4 pb-3">
                <h4 className="font-semibold text-sm mb-1">{space.space_name}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{space.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {space.capacity_seated && (
                    <Badge variant="outline" className="text-[10px]">
                      <Users className="h-3 w-3 mr-1" /> {space.capacity_seated} seated
                    </Badge>
                  )}
                  {space.capacity_standing && (
                    <Badge variant="outline" className="text-[10px]">{space.capacity_standing} standing</Badge>
                  )}
                  {space.square_footage && (
                    <Badge variant="outline" className="text-[10px]">{space.square_footage} sq ft</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {space.hourly_rate && <span><DollarSign className="h-3 w-3 inline" />${Number(space.hourly_rate).toFixed(0)}/hr</span>}
                  {space.full_day_rate && <span>${Number(space.full_day_rate).toFixed(0)}/day</span>}
                  {space.wheelchair_accessible && <Accessibility className="h-3.5 w-3.5 text-emerald-500" />}
                  {space.valet_available && <Car className="h-3.5 w-3.5 text-blue-500" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
