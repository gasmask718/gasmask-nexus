import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Layers, Sparkles, Globe } from 'lucide-react';
import { usePartnerListings, useUpsertListing } from '@/hooks/useUTPartnerPortal';

interface Props { partnerId: string; }

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-500/10 text-amber-600',
  published: 'bg-emerald-500/10 text-emerald-600',
  paused: 'bg-red-500/10 text-red-600',
};

export default function UTPartnerListings({ partnerId }: Props) {
  const { data: listings = [] } = usePartnerListings(partnerId);
  const upsert = useUpsertListing();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const update = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    upsert.mutate({ ...form, partner_id: partnerId }, { onSuccess: () => { setOpen(false); setForm({}); } });
  };

  const publish = (listing: any) => {
    upsert.mutate({ id: listing.id, status: 'published', published_at: new Date().toISOString(), partner_id: partnerId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Listings ({listings.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Listing</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Listing</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title || ''} onChange={e => update('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Listing Type</Label>
                <Select value={form.listing_type || 'venue'} onValueChange={v => update('listing_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venue">Venue</SelectItem>
                    <SelectItem value="rental_item">Rental Item</SelectItem>
                    <SelectItem value="catering_menu">Catering Menu</SelectItem>
                    <SelectItem value="decoration_package">Decoration Package</SelectItem>
                    <SelectItem value="staff_service">Staff Service</SelectItem>
                    <SelectItem value="photography">Photography</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description || ''} onChange={e => update('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Price ($)</Label>
                  <Input type="number" value={form.base_price || ''} onChange={e => update('base_price', parseFloat(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Price Label</Label>
                  <Input value={form.price_label || ''} onChange={e => update('price_label', e.target.value)} placeholder="e.g. Starting at $500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={form.location_city || ''} onChange={e => update('location_city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={form.location_state || ''} onChange={e => update('location_state', e.target.value)} />
                </div>
              </div>
              <Button onClick={save} disabled={upsert.isPending} className="w-full">Create Listing</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {listings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No listings yet. Create your first listing or use the AI Wizard.</p>
            </CardContent>
          </Card>
        ) : listings.map(listing => (
          <Card key={listing.id} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{listing.title}</h4>
                    <Badge className={`text-[10px] ${STATUS_COLORS[listing.status || 'draft']}`}>
                      {listing.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{listing.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{listing.listing_type}</span>
                    {listing.base_price && <span className="font-medium text-foreground">${Number(listing.base_price).toFixed(0)}</span>}
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {listing.view_count}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {listing.status === 'draft' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => publish(listing)}>
                      <Globe className="h-3 w-3 mr-1" /> Publish
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
