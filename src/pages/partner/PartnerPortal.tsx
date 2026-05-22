import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useDecoratorPackages,
  useDecoratorPackageMutations,
  DECOR_CATEGORIES,
  type DecoratorPackage,
} from '@/hooks/toptier/useDecoratorPackages';

type Partner = {
  id: string;
  business_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  portal_status: string;
  partner_type: string | null;
};

// Every transport partner_type currently registered in tt_service_routing.
// Anything in this set keeps the legacy Dispatch + Bookings view (pure regression-safe).
// Anything NOT in this set and NOT 'decorator' falls to the safe Profile + Bookings default.
const TRANSPORT_TYPES = new Set<string>([
  'chauffeur',
  'sedan',
  'suv',
  'exotic_supplier',
  'sprinter_operator',
  'party_bus_operator',
  'coach_operator',
  'helicopter_operator',
  'aviation_broker',
  'yacht_operator',
  'watercraft_operator',
  'novelty_operator',
]);
const DECORATOR_TYPES = new Set<string>(['decorator']);

export default function PartnerPortal() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: p, error: pErr } = await supabase
      .from('tt_partners')
      .select('id, business_name, name, email, phone, portal_status, partner_type')
      .maybeSingle();
    if (pErr) {
      toast.error(pErr.message);
      setLoading(false);
      return;
    }
    setPartner(p as Partner | null);

    const [{ data: d, error: dErr }, { data: b, error: bErr }] = await Promise.all([
      supabase
        .from('tt_dispatch_requests')
        .select('id, booking_reference, service_type, pickup_location, scheduled_at, status, total_price, accepted_at, expires_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('tt_bookings')
        .select('id, booking_reference, service_type, scheduled_at, status, total_price, pickup_location, dropoff_location')
        .order('scheduled_at', { ascending: false })
        .limit(50),
    ]);
    if (dErr) toast.error(`Dispatch: ${dErr.message}`);
    if (bErr) toast.error(`Bookings: ${bErr.message}`);
    setDispatches(d ?? []);
    setBookings(b ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('tt_dispatch_requests')
      .update({ status, accepted_at: status === 'accepted' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(`Dispatch ${status}`);
    load();
  };

  // ── tab visibility (additive — transport behavior unchanged) ──
  const { isDecorator, isTransport, showDispatch, showPackages, showProfile, defaultTab } = useMemo(() => {
    const pt = partner?.partner_type ?? '';
    const dec = DECORATOR_TYPES.has(pt);
    const tx = TRANSPORT_TYPES.has(pt);
    const dispatch = tx;                          // unchanged for transport
    const packages = dec;
    const profile = dec || (!tx && pt !== '');    // decorators + unknown types
    const dflt = dispatch ? 'dispatches' : packages ? 'packages' : profile ? 'profile' : 'bookings';
    return {
      isDecorator: dec,
      isTransport: tx,
      showDispatch: dispatch,
      showPackages: packages,
      showProfile: profile,
      defaultTab: dflt,
    };
  }, [partner?.partner_type]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!partner) return <div className="p-8">No partner record linked to your account. Contact admin.</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{partner.business_name ?? partner.name}</h1>
            <p className="text-sm text-muted-foreground">
              {partner.email} · {partner.phone}
              {partner.partner_type && <> · <span className="capitalize">{partner.partner_type.replace(/_/g, ' ')}</span></>}
            </p>
          </div>
          <Badge variant="secondary">{partner.portal_status}</Badge>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {showProfile && <TabsTrigger value="profile">Profile</TabsTrigger>}
            {showPackages && <TabsTrigger value="packages">Marketplace Packages</TabsTrigger>}
            {showDispatch && <TabsTrigger value="dispatches">Dispatch Requests ({dispatches.length})</TabsTrigger>}
            <TabsTrigger value="bookings">Booking History ({bookings.length})</TabsTrigger>
          </TabsList>

          {showProfile && (
            <TabsContent value="profile">
              <DecoratorProfileTab partnerId={partner.id} isDecorator={isDecorator} />
            </TabsContent>
          )}

          {showPackages && (
            <TabsContent value="packages">
              <DecoratorPackagesTab ttPartnerId={partner.id} />
            </TabsContent>
          )}

          {showDispatch && (
            <TabsContent value="dispatches" className="space-y-3">
              {dispatches.length === 0 && (
                <Card className="p-6 text-sm text-muted-foreground">No dispatch requests yet.</Card>
              )}
              {dispatches.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{d.service_type} · {d.booking_reference}</div>
                      <div className="text-sm text-muted-foreground">{d.pickup_location}</div>
                      <div className="text-xs mt-1">{d.scheduled_at && new Date(d.scheduled_at).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <Badge>{d.status}</Badge>
                      <div className="text-sm mt-1">${d.total_price ?? '—'}</div>
                    </div>
                  </div>
                  {d.status === 'sent' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => respond(d.id, 'accepted')}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => respond(d.id, 'declined')}>Decline</Button>
                    </div>
                  )}
                </Card>
              ))}
            </TabsContent>
          )}

          <TabsContent value="bookings" className="space-y-3">
            {bookings.length === 0 && (
              <Card className="p-6 text-sm text-muted-foreground">No bookings yet.</Card>
            )}
            {bookings.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{b.service_type} · {b.booking_reference}</div>
                    <div className="text-sm text-muted-foreground">
                      {b.pickup_location} → {b.dropoff_location}
                    </div>
                    <div className="text-xs mt-1">{b.scheduled_at && new Date(b.scheduled_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <Badge>{b.status}</Badge>
                    <div className="text-sm mt-1">${b.total_price ?? '—'}</div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Decorator: read-only profile card (linked decorators row) ──
function DecoratorProfileTab({ partnerId, isDecorator }: { partnerId: string; isDecorator: boolean }) {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isDecorator) { setLoading(false); return; }
    (async () => {
      const { data, error } = await (supabase as any)
        .from('decorators')
        .select('id, name, city, state, service_radius_miles, bio, specialties, portfolio_images, base_price_min, base_price_max')
        .eq('tt_partner_id', partnerId)
        .maybeSingle();
      if (error) toast.error(error.message);
      setProfile(data);
      setLoading(false);
    })();
  }, [partnerId, isDecorator]);

  if (!isDecorator) {
    return <Card className="p-6 text-sm text-muted-foreground">Profile editing coming soon for this partner type.</Card>;
  }
  if (loading) return <Card className="p-6 text-sm">Loading profile…</Card>;
  if (!profile) return <Card className="p-6 text-sm text-muted-foreground">No decorator profile linked. Contact admin.</Card>;

  return (
    <Card className="p-6 space-y-3">
      <div>
        <div className="text-lg font-semibold">{profile.name}</div>
        <div className="text-sm text-muted-foreground">
          {profile.city}{profile.state ? `, ${profile.state}` : ''} · {profile.service_radius_miles ?? 25} mi radius
        </div>
      </div>
      {profile.bio && <p className="text-sm">{profile.bio}</p>}
      {profile.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.specialties.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Profile edits are admin-managed for now. Manage your live offerings in the Marketplace Packages tab.
      </p>
    </Card>
  );
}

// ── Decorator: marketplace packages CRUD ──
function DecoratorPackagesTab({ ttPartnerId }: { ttPartnerId: string }) {
  const { data: packages = [], isLoading } = useDecoratorPackages(ttPartnerId);
  const { createPackage, updatePackage, deletePackage, publishPackage } =
    useDecoratorPackageMutations(ttPartnerId);

  const [editing, setEditing] = useState<DecoratorPackage | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Your Packages</h3>
          <p className="text-xs text-muted-foreground">
            Set your own price. Platform fee is shown per package.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDraftOpen(true); }}>
          + New Package
        </Button>
      </div>

      {isLoading && <Card className="p-6 text-sm">Loading…</Card>}

      {!isLoading && packages.length === 0 && !draftOpen && (
        <Card className="p-6 text-sm text-muted-foreground">
          No packages yet. Create one to appear in the marketplace once published.
        </Card>
      )}

      {draftOpen && (
        <PackageForm
          initial={editing}
          onCancel={() => { setDraftOpen(false); setEditing(null); }}
          onSubmit={async (input) => {
            try {
              if (editing) {
                await updatePackage.mutateAsync({ id: editing.id, patch: input });
                toast.success('Package updated');
              } else {
                await createPackage.mutateAsync(input);
                toast.success('Package created');
              }
              setDraftOpen(false);
              setEditing(null);
            } catch (e: any) {
              toast.error(e.message ?? 'Failed to save');
            }
          }}
          busy={createPackage.isPending || updatePackage.isPending}
        />
      )}

      <div className="space-y-2">
        {packages.map((p) => {
          const feePct = Number(p.platform_fee_pct ?? 15);
          const fee = (Number(p.price) * feePct) / 100;
          const take = Number(p.price) - fee;
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{p.name}</div>
                    <Badge variant="outline" className="text-[10px]">
                      {DECOR_CATEGORIES.find(c => c.slug === p.category)?.label ?? p.category}
                    </Badge>
                    {p.is_published
                      ? <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600">Published</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                  <div className="text-xs text-muted-foreground mt-2">
                    Price <span className="font-semibold text-foreground">${Number(p.price).toFixed(2)}</span>
                    {' · '}Platform fee {feePct}% (${fee.toFixed(2)})
                    {' · '}You receive <span className="font-semibold text-foreground">${take.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-2 text-xs">
                    <span>Published</span>
                    <Switch
                      checked={p.is_published}
                      onCheckedChange={(v) =>
                        publishPackage.mutate(
                          { id: p.id, is_published: v },
                          { onError: (e: any) => toast.error(e.message) },
                        )
                      }
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(p); setDraftOpen(true); }}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${p.name}"?`)) {
                          deletePackage.mutate(p.id, {
                            onSuccess: () => toast.success('Deleted'),
                            onError: (e: any) => toast.error(e.message),
                          });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PackageForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: DecoratorPackage | null;
  onSubmit: (input: {
    category: string;
    name: string;
    description: string | null;
    price: number;
    platform_fee_pct: number;
  }) => void | Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [category, setCategory] = useState(initial?.category ?? DECOR_CATEGORIES[0].slug);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState<string>(initial ? String(initial.price) : '');
  const [feePct, setFeePct] = useState<string>(initial ? String(initial.platform_fee_pct) : '15');

  const submit = () => {
    const priceNum = Number(price);
    const feeNum = Number(feePct);
    if (!name.trim()) return toast.error('Name is required');
    if (!Number.isFinite(priceNum) || priceNum <= 0) return toast.error('Price must be greater than 0');
    if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 100) return toast.error('Fee must be 0–100');
    onSubmit({
      category,
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      platform_fee_pct: feeNum,
    });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="font-medium">{initial ? 'Edit package' : 'New package'}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DECOR_CATEGORIES.map(c => (
                <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rose Petal Vehicle Surprise" />
        </div>
        <div>
          <Label>Price (USD)</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label>Platform fee %</Label>
          <Input type="number" min="0" max="100" step="0.1" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Description</Label>
          <Textarea rows={3} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </Card>
  );
}
