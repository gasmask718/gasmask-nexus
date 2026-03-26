import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Palette, Plus, Star, Package, Image, Sparkles, 
  Layers, MessageSquare, DollarSign, Tag, Eye,
  Paintbrush, Flower2, CircleDot
} from 'lucide-react';
import {
  useCreativeProfile, useUpsertCreativeProfile,
  useCreativeCollections, useUpsertCollection,
  useCreativeOfferings, useUpsertOffering,
  useCreativeMedia,
  useCreativePackages, useUpsertCreativePackage,
  useCustomRequests
} from '@/hooks/useUTCreativePortal';

interface Props { partnerId: string; }

const CREATIVE_TYPES = ['decorator','florist','stylist','balloon_artist','event_designer','draping','lighting_designer'];
const STYLE_TAGS = ['modern','rustic','luxury','minimal','colorful','bohemian','vintage','industrial','tropical','glamorous'];
const OFFERING_CATEGORIES = ['backdrop','balloons','floral','draping','centerpiece','arch','table_setting','lighting','props','signage','linens'];

export default function UTDecoratorModule({ partnerId }: Props) {
  const [activeTab, setActiveTab] = useState('profile');
  const [showCollForm, setShowCollForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showPkgForm, setShowPkgForm] = useState(false);

  const { data: profile } = useCreativeProfile(partnerId);
  const upsertProfile = useUpsertCreativeProfile();
  const { data: collections = [] } = useCreativeCollections(partnerId);
  const upsertColl = useUpsertCollection();
  const { data: offerings = [] } = useCreativeOfferings(partnerId);
  const upsertOffer = useUpsertOffering();
  const { data: media = [] } = useCreativeMedia(partnerId);
  const { data: packages = [] } = useCreativePackages(partnerId);
  const upsertPkg = useUpsertCreativePackage();
  const { data: requests = [] } = useCustomRequests(partnerId);

  // Readiness
  const readiness = (() => {
    let score = 0; const reasons: string[] = [];
    if (profile) score += 15; else reasons.push('Creative profile missing');
    if (profile?.style_tags?.length) score += 10; else reasons.push('No style tags');
    if (collections.length > 0) score += 15; else reasons.push('No collections');
    if (offerings.length > 0) score += 15; else reasons.push('No offerings');
    if (media.length > 0) score += 15; else reasons.push('No portfolio media');
    if (media.length >= 5) score += 5;
    if (packages.length > 0) score += 15; else reasons.push('No packages');
    if (profile?.min_spend) score += 5; else reasons.push('Min spend not set');
    if (profile?.service_radius) score += 5; else reasons.push('Service radius not set');
    return { score, reasons };
  })();

  const [collForm, setCollForm] = useState({ name: '', theme_type: '', event_type: '', description: '', base_price: '' });
  const [offerForm, setOfferForm] = useState({ name: '', category: 'backdrop', description: '', base_price: '', price_type: 'flat' });
  const [pkgForm, setPkgForm] = useState({ name: '', category: '', description: '', package_price: '', event_type: '' });

  const handleSaveColl = () => {
    upsertColl.mutate({ partner_id: partnerId, ...collForm, base_price: collForm.base_price ? Number(collForm.base_price) : null });
    setShowCollForm(false);
    setCollForm({ name: '', theme_type: '', event_type: '', description: '', base_price: '' });
  };

  const handleSaveOffer = () => {
    upsertOffer.mutate({ partner_id: partnerId, ...offerForm, base_price: offerForm.base_price ? Number(offerForm.base_price) : null });
    setShowOfferForm(false);
    setOfferForm({ name: '', category: 'backdrop', description: '', base_price: '', price_type: 'flat' });
  };

  const handleSavePkg = () => {
    upsertPkg.mutate({ partner_id: partnerId, ...pkgForm, package_price: pkgForm.package_price ? Number(pkgForm.package_price) : null });
    setShowPkgForm(false);
    setPkgForm({ name: '', category: '', description: '', package_price: '', event_type: '' });
  };

  return (
    <div className="space-y-4">
      {/* Header + Readiness */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-lg">
            <Paintbrush className="h-5 w-5 text-primary" /> Creative Studio
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Visual-first decorator & creative services</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${readiness.score}%` }} />
            </div>
            <span className="text-xs font-medium">{readiness.score}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Publish Ready</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {[
            { id: 'profile', label: 'Profile', icon: Palette },
            { id: 'collections', label: 'Collections', icon: Layers },
            { id: 'offerings', label: 'Offerings', icon: Flower2 },
            { id: 'portfolio', label: 'Portfolio', icon: Image },
            { id: 'packages', label: 'Packages', icon: Package },
            { id: 'requests', label: 'Custom Requests', icon: MessageSquare },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Creative Type</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1.5 flex-wrap">
                  {CREATIVE_TYPES.map(t => (
                    <Badge key={t} variant={profile?.creative_type === t ? 'default' : 'outline'}
                      className="cursor-pointer text-[10px]"
                      onClick={() => upsertProfile.mutate({ partner_id: partnerId, creative_type: t })}>
                      {t.replace('_',' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Style Identity</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1.5 flex-wrap">
                  {STYLE_TAGS.map(s => (
                    <Badge key={s} variant={(profile?.style_tags as string[] || []).includes(s) ? 'default' : 'outline'}
                      className="cursor-pointer text-[10px]"
                      onClick={() => {
                        const current = (profile?.style_tags as string[]) || [];
                        const updated = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                        upsertProfile.mutate({ partner_id: partnerId, style_tags: updated });
                      }}>
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Service Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Min Spend ($)</label>
                  <Input type="number" className="h-8 text-sm" defaultValue={profile?.min_spend || ''}
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, min_spend: Number(e.target.value) || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Service Radius (mi)</label>
                  <Input type="number" className="h-8 text-sm" defaultValue={profile?.service_radius || ''}
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, service_radius: Number(e.target.value) || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Setup Time</label>
                  <Input className="h-8 text-sm" placeholder="e.g. 3 hours" defaultValue={profile?.setup_time_required || ''}
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, setup_time_required: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Rush Fee Rules</label>
                  <Input className="h-8 text-sm" placeholder="e.g. +25% under 48h" defaultValue={profile?.rush_fee_rules || ''}
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, rush_fee_rules: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Capabilities</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: 'customization_supported', label: 'Custom Designs' },
                  { key: 'teardown_included', label: 'Teardown Included' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-xs">{item.label}</span>
                    <Badge variant={(profile as any)?.[item.key] ? 'default' : 'outline'} className="cursor-pointer text-[10px]"
                      onClick={() => upsertProfile.mutate({ partner_id: partnerId, [item.key]: !(profile as any)?.[item.key] })}>
                      {(profile as any)?.[item.key] ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COLLECTIONS TAB */}
        <TabsContent value="collections" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{collections.length} collection{collections.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowCollForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Collection</Button>
          </div>

          {showCollForm && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Collection Name" className="h-8 text-sm" value={collForm.name} onChange={e => setCollForm(p => ({ ...p, name: e.target.value }))} />
                  <Input placeholder="Theme (e.g. Enchanted Garden)" className="h-8 text-sm" value={collForm.theme_type} onChange={e => setCollForm(p => ({ ...p, theme_type: e.target.value }))} />
                </div>
                <Textarea placeholder="Description" rows={2} className="text-sm" value={collForm.description} onChange={e => setCollForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Base Price" type="number" className="h-8 text-sm" value={collForm.base_price} onChange={e => setCollForm(p => ({ ...p, base_price: e.target.value }))} />
                  <select className="h-8 text-sm rounded-md border bg-background px-2" value={collForm.event_type} onChange={e => setCollForm(p => ({ ...p, event_type: e.target.value }))}>
                    <option value="">Event Type</option>
                    {['wedding','birthday','corporate','baby_shower','graduation','quinceañera','holiday'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveColl} disabled={!collForm.name}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCollForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {collections.map(col => (
              <Card key={col.id} className="border-border/50 hover:border-primary/50 transition-all">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{col.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {col.theme_type && `${col.theme_type} • `}{col.event_type || 'General'}
                      </p>
                    </div>
                    {col.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {col.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{col.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {col.base_price && <Badge variant="outline" className="text-[10px]"><DollarSign className="h-3 w-3 mr-0.5" />${Number(col.base_price).toFixed(0)}</Badge>}
                    {(col.style_tags as string[] || []).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* OFFERINGS TAB */}
        <TabsContent value="offerings" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{offerings.length} offering{offerings.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowOfferForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Offering</Button>
          </div>

          {showOfferForm && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Offering Name" className="h-8 text-sm" value={offerForm.name} onChange={e => setOfferForm(p => ({ ...p, name: e.target.value }))} />
                  <select className="h-8 text-sm rounded-md border bg-background px-2" value={offerForm.category} onChange={e => setOfferForm(p => ({ ...p, category: e.target.value }))}>
                    {OFFERING_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
                <Textarea placeholder="Description" rows={2} className="text-sm" value={offerForm.description} onChange={e => setOfferForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Base Price" type="number" className="h-8 text-sm" value={offerForm.base_price} onChange={e => setOfferForm(p => ({ ...p, base_price: e.target.value }))} />
                  <select className="h-8 text-sm rounded-md border bg-background px-2" value={offerForm.price_type} onChange={e => setOfferForm(p => ({ ...p, price_type: e.target.value }))}>
                    <option value="flat">Flat Rate</option>
                    <option value="per_unit">Per Unit</option>
                    <option value="custom">Custom Quote</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveOffer} disabled={!offerForm.name}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowOfferForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Group by category */}
          {OFFERING_CATEGORIES.filter(cat => offerings.some(o => o.category === cat)).map(cat => (
            <div key={cat}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat.replace('_',' ')}</h4>
              <div className="grid gap-2 md:grid-cols-2">
                {offerings.filter(o => o.category === cat).map(off => (
                  <div key={off.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card">
                    <div>
                      <p className="text-sm font-medium">{off.name}</p>
                      {off.description && <p className="text-xs text-muted-foreground line-clamp-1">{off.description}</p>}
                    </div>
                    {off.base_price && <Badge variant="outline" className="text-[10px]">${Number(off.base_price).toFixed(0)}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* PORTFOLIO TAB */}
        <TabsContent value="portfolio" className="space-y-4 mt-4">
          <Card className={media.length === 0 ? 'border-dashed' : ''}>
            <CardContent className="py-8 text-center">
              <Image className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{media.length === 0 ? 'No portfolio media yet' : `${media.length} portfolio items`}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Upload event galleries, before/after sets, video reels</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowPkgForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Package</Button>
          </div>

          {showPkgForm && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Package Name" className="h-8 text-sm" value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} />
                  <select className="h-8 text-sm rounded-md border bg-background px-2" value={pkgForm.event_type} onChange={e => setPkgForm(p => ({ ...p, event_type: e.target.value }))}>
                    <option value="">Event Type</option>
                    {['wedding','birthday','corporate','baby_shower','quinceañera','graduation'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Textarea placeholder="What's included..." rows={2} className="text-sm" value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} />
                <Input placeholder="Package Price" type="number" className="h-8 text-sm" value={pkgForm.package_price} onChange={e => setPkgForm(p => ({ ...p, package_price: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePkg} disabled={!pkgForm.name}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowPkgForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {packages.map(pkg => (
              <Card key={pkg.id} className="border-border/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{pkg.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{pkg.event_type || pkg.category || 'General'}</p>
                    </div>
                    {pkg.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{pkg.description}</p>}
                  {pkg.package_price && <Badge variant="outline" className="text-[10px] mt-2"><DollarSign className="h-3 w-3 mr-0.5" />${Number(pkg.package_price).toFixed(0)}</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CUSTOM REQUESTS TAB */}
        <TabsContent value="requests" className="space-y-4 mt-4">
          {requests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No custom requests yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Custom design requests from customers will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <Card key={req.id} className="border-border/50">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{req.customer_name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground">{req.event_type} • {req.event_date}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.description}</p>
                      </div>
                      <Badge variant={req.status === 'new' ? 'default' : 'secondary'} className="text-[10px]">
                        {req.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
