import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Building2 } from 'lucide-react';
import { usePartnerById, useUpsertPartner } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

const CATEGORIES = [
  'event_hall', 'party_rental', 'caterer', 'bartender', 'decorator',
  'photographer', 'videographer', 'dj', 'florist', 'planner',
  'staff_provider', 'entertainment', 'bakery', 'lighting', 'photo_booth', 'other'
];

export default function UTPartnerProfile({ partnerId }: Props) {
  const { data: partner } = usePartnerById(partnerId);
  const upsert = useUpsertPartner();
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (partner) setForm(partner);
  }, [partner]);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const save = () => upsert.mutate({ ...form, id: partnerId });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={form.business_name || ''} onChange={e => update('business_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category || 'other'} onValueChange={v => update('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={form.contact_name || ''} onChange={e => update('contact_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={e => update('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website || ''} onChange={e => update('website', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={form.description || ''} onChange={e => update('description', e.target.value)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address_line1 || ''} onChange={e => update('address_line1', e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.address_city || ''} onChange={e => update('address_city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.address_state || ''} onChange={e => update('address_state', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input value={form.address_zip || ''} onChange={e => update('address_zip', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Service Radius (miles)</Label>
              <Input type="number" value={form.service_radius_miles || 25} onChange={e => update('service_radius_miles', parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Years in Business</Label>
              <Input type="number" value={form.years_in_business || ''} onChange={e => update('years_in_business', parseInt(e.target.value))} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={upsert.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
