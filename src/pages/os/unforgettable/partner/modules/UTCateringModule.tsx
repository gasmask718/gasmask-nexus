import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UtensilsCrossed, Users, DollarSign, Wine, ChefHat, Plus, 
  Clock, Star, Package, Image, Calendar, Sparkles, CheckCircle2,
  GlassWater, Flame, Leaf
} from 'lucide-react';
import { 
  useFoodProfile, useUpsertFoodProfile,
  usePartnerMenus, useUpsertMenu,
  useMenuItems, useUpsertMenuItem,
  useServicePackages, useUpsertServicePackage,
  useFoodMedia, useFoodAvailability
} from '@/hooks/useUTCatererPortal';

interface Props { partnerId: string; }

const MENU_CATEGORIES = ['appetizer','entree','dessert','side','drink','cocktail','beer_wine','signature'];
const SERVICE_STYLES = ['buffet','plated','stations','cocktail','family_style','open_bar','limited_bar'];
const DIETARY_TAGS = ['vegan','vegetarian','halal','kosher','gluten_free','dairy_free','nut_free','keto'];

export default function UTCateringModule({ partnerId }: Props) {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showPkgForm, setShowPkgForm] = useState(false);

  const { data: profile } = useFoodProfile(partnerId);
  const upsertProfile = useUpsertFoodProfile();
  const { data: menus = [] } = usePartnerMenus(partnerId);
  const upsertMenu = useUpsertMenu();
  const { data: menuItems = [] } = useMenuItems(selectedMenuId || undefined);
  const upsertItem = useUpsertMenuItem();
  const { data: packages = [] } = useServicePackages(partnerId);
  const upsertPkg = useUpsertServicePackage();
  const { data: media = [] } = useFoodMedia(partnerId);
  const { data: availability = [] } = useFoodAvailability(partnerId);

  // Readiness score
  const readiness = (() => {
    let score = 0; const reasons: string[] = [];
    if (profile) score += 15; else reasons.push('Food profile missing');
    if (profile?.cuisine_types?.length) score += 10; else reasons.push('No cuisine types');
    if (menus.length > 0) score += 20; else reasons.push('No menus created');
    if (menus.some(m => m.is_featured)) score += 5;
    if (packages.length > 0) score += 15; else reasons.push('No service packages');
    if (media.length > 0) score += 15; else reasons.push('No food media');
    if (media.length >= 5) score += 5;
    if (profile?.min_guest_count) score += 5; else reasons.push('Guest count not set');
    if (availability.length > 0) score += 10; else reasons.push('No availability set');
    return { score, reasons };
  })();

  // Menu form state
  const [menuForm, setMenuForm] = useState({ name: '', menu_type: 'general', description: '', price_type: 'per_person' as string, base_price: '', guest_range_min: '', guest_range_max: '', service_style: '' });
  const [itemForm, setItemForm] = useState({ item_name: '', category: 'entree', description: '', is_signature: false, upgrade_price: '' });
  const [pkgForm, setPkgForm] = useState({ name: '', description: '', base_price: '', price_type: 'per_person', hours_included: '', staffing_count: '', event_type: '' });

  const handleSaveMenu = () => {
    upsertMenu.mutate({ 
      partner_id: partnerId, 
      ...menuForm, 
      base_price: menuForm.base_price ? Number(menuForm.base_price) : null,
      guest_range_min: menuForm.guest_range_min ? Number(menuForm.guest_range_min) : null,
      guest_range_max: menuForm.guest_range_max ? Number(menuForm.guest_range_max) : null,
    });
    setShowMenuForm(false);
    setMenuForm({ name: '', menu_type: 'general', description: '', price_type: 'per_person', base_price: '', guest_range_min: '', guest_range_max: '', service_style: '' });
  };

  const handleSaveItem = () => {
    if (!selectedMenuId) return;
    upsertItem.mutate({
      menu_id: selectedMenuId,
      ...itemForm,
      upgrade_price: itemForm.upgrade_price ? Number(itemForm.upgrade_price) : null,
    });
    setShowItemForm(false);
    setItemForm({ item_name: '', category: 'entree', description: '', is_signature: false, upgrade_price: '' });
  };

  const handleSavePkg = () => {
    upsertPkg.mutate({
      partner_id: partnerId,
      ...pkgForm,
      base_price: pkgForm.base_price ? Number(pkgForm.base_price) : null,
      hours_included: pkgForm.hours_included ? Number(pkgForm.hours_included) : null,
      staffing_count: pkgForm.staffing_count ? Number(pkgForm.staffing_count) : null,
    });
    setShowPkgForm(false);
    setPkgForm({ name: '', description: '', base_price: '', price_type: 'per_person', hours_included: '', staffing_count: '', event_type: '' });
  };

  return (
    <div className="space-y-4">
      {/* Header + Readiness */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-lg">
            <ChefHat className="h-5 w-5 text-primary" /> Food & Beverage Engine
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Full-service catering & bartending management</p>
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
            { id: 'profile', label: 'Profile', icon: ChefHat },
            { id: 'menus', label: 'Menus', icon: UtensilsCrossed },
            { id: 'items', label: 'Menu Builder', icon: Flame },
            { id: 'packages', label: 'Packages', icon: Package },
            { id: 'media', label: 'Media', icon: Image },
            { id: 'availability', label: 'Availability', icon: Calendar },
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
              <CardHeader className="pb-2"><CardTitle className="text-sm">Service Identity</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {['caterer','bartender','hybrid'].map(t => (
                    <Badge key={t} variant={profile?.service_type === t ? 'default' : 'outline'} 
                      className="cursor-pointer text-xs"
                      onClick={() => upsertProfile.mutate({ partner_id: partnerId, service_type: t })}>
                      {t}
                    </Badge>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cuisine Types</label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {['American','Mexican','Italian','Asian','BBQ','Mediterranean','Caribbean','Fusion','Soul Food','Indian'].map(c => (
                      <Badge key={c} variant={(profile?.cuisine_types as string[] || []).includes(c) ? 'default' : 'outline'}
                        className="cursor-pointer text-[10px]"
                        onClick={() => {
                          const current = (profile?.cuisine_types as string[]) || [];
                          const updated = current.includes(c) ? current.filter(x => x !== c) : [...current, c];
                          upsertProfile.mutate({ partner_id: partnerId, cuisine_types: updated });
                        }}>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Capacity & Pricing</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Min Guests</label>
                  <Input type="number" className="h-8 text-sm" defaultValue={profile?.min_guest_count || ''} 
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, min_guest_count: Number(e.target.value) || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Guests</label>
                  <Input type="number" className="h-8 text-sm" defaultValue={profile?.max_guest_count || ''} 
                    onBlur={e => upsertProfile.mutate({ partner_id: partnerId, max_guest_count: Number(e.target.value) || null })} />
                </div>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wine className="h-4 w-4" /> Bar & Beverage</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: 'alcohol_service_capability', label: 'Alcohol Service' },
                  { key: 'alcohol_provided', label: 'We Provide Alcohol' },
                  { key: 'outside_alcohol_allowed', label: 'Outside Alcohol Allowed' },
                  { key: 'tasting_available', label: 'Tasting Available' },
                  { key: 'consultation_required', label: 'Consultation Required' },
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Leaf className="h-4 w-4" /> Dietary</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1.5 flex-wrap">
                  {DIETARY_TAGS.map(d => (
                    <Badge key={d} variant={(profile?.dietary_capabilities as string[] || []).includes(d) ? 'default' : 'outline'}
                      className="cursor-pointer text-[10px]"
                      onClick={() => {
                        const current = (profile?.dietary_capabilities as string[]) || [];
                        const updated = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
                        upsertProfile.mutate({ partner_id: partnerId, dietary_capabilities: updated });
                      }}>
                      {d.replace('_',' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MENUS TAB */}
        <TabsContent value="menus" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{menus.length} menu{menus.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowMenuForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Menu</Button>
          </div>

          {showMenuForm && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Menu Name" className="h-8 text-sm" value={menuForm.name} onChange={e => setMenuForm(p => ({ ...p, name: e.target.value }))} />
                  <select className="h-8 text-sm rounded-md border bg-background px-2" value={menuForm.menu_type} onChange={e => setMenuForm(p => ({ ...p, menu_type: e.target.value }))}>
                    {['general','wedding','corporate','birthday','bar_package','brunch','holiday'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <Textarea placeholder="Description" rows={2} className="text-sm" value={menuForm.description} onChange={e => setMenuForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="Base Price" type="number" className="h-8 text-sm" value={menuForm.base_price} onChange={e => setMenuForm(p => ({ ...p, base_price: e.target.value }))} />
                  <Input placeholder="Min Guests" type="number" className="h-8 text-sm" value={menuForm.guest_range_min} onChange={e => setMenuForm(p => ({ ...p, guest_range_min: e.target.value }))} />
                  <Input placeholder="Max Guests" type="number" className="h-8 text-sm" value={menuForm.guest_range_max} onChange={e => setMenuForm(p => ({ ...p, guest_range_max: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMenu} disabled={!menuForm.name}>Save Menu</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMenuForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {menus.map(menu => (
              <Card key={menu.id} className={`cursor-pointer transition-all hover:border-primary/50 ${selectedMenuId === menu.id ? 'border-primary ring-1 ring-primary/20' : 'border-border/50'}`}
                onClick={() => { setSelectedMenuId(menu.id); setActiveTab('items'); }}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{menu.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{menu.menu_type?.replace('_',' ')} • {menu.service_style || menu.price_type}</p>
                    </div>
                    {menu.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {menu.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{menu.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {menu.base_price && (
                      <Badge variant="outline" className="text-[10px]">
                        <DollarSign className="h-3 w-3 mr-0.5" />${Number(menu.base_price).toFixed(0)}/{menu.price_type === 'per_person' ? 'person' : 'flat'}
                      </Badge>
                    )}
                    {menu.guest_range_min && (
                      <Badge variant="outline" className="text-[10px]">
                        <Users className="h-3 w-3 mr-0.5" /> {menu.guest_range_min}–{menu.guest_range_max || '∞'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* MENU BUILDER TAB */}
        <TabsContent value="items" className="space-y-4 mt-4">
          {!selectedMenuId ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a menu from the Menus tab to build items</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Building: {menus.find(m => m.id === selectedMenuId)?.name}</p>
                  <p className="text-xs text-muted-foreground">{menuItems.length} item{menuItems.length !== 1 ? 's' : ''}</p>
                </div>
                <Button size="sm" onClick={() => setShowItemForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Item</Button>
              </div>

              {showItemForm && (
                <Card className="border-primary/30">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Item Name" className="h-8 text-sm" value={itemForm.item_name} onChange={e => setItemForm(p => ({ ...p, item_name: e.target.value }))} />
                      <select className="h-8 text-sm rounded-md border bg-background px-2" value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))}>
                        {MENU_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                      </select>
                    </div>
                    <Textarea placeholder="Description" rows={2} className="text-sm" value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} />
                    <div className="flex items-center gap-3">
                      <Input placeholder="Upgrade $" type="number" className="h-8 text-sm w-28" value={itemForm.upgrade_price} onChange={e => setItemForm(p => ({ ...p, upgrade_price: e.target.value }))} />
                      <Badge variant={itemForm.is_signature ? 'default' : 'outline'} className="cursor-pointer text-xs"
                        onClick={() => setItemForm(p => ({ ...p, is_signature: !p.is_signature }))}>
                        <Star className="h-3 w-3 mr-1" /> Signature
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveItem} disabled={!itemForm.item_name}>Save Item</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowItemForm(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Group items by category */}
              {MENU_CATEGORIES.filter(cat => menuItems.some(i => i.category === cat)).map(cat => (
                <div key={cat}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat.replace('_',' ')}</h4>
                  <div className="space-y-1.5">
                    {menuItems.filter(i => i.category === cat).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card">
                        <div className="flex items-center gap-2">
                          {item.is_signature && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                          <div>
                            <p className="text-sm font-medium">{item.item_name}</p>
                            {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                          </div>
                        </div>
                        {item.upgrade_price && (
                          <Badge variant="outline" className="text-[10px]">+${Number(item.upgrade_price).toFixed(0)}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
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
                    {['wedding','corporate','birthday','private','holiday','graduation'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Textarea placeholder="What's included..." rows={2} className="text-sm" value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="Base Price" type="number" className="h-8 text-sm" value={pkgForm.base_price} onChange={e => setPkgForm(p => ({ ...p, base_price: e.target.value }))} />
                  <Input placeholder="Hours" type="number" className="h-8 text-sm" value={pkgForm.hours_included} onChange={e => setPkgForm(p => ({ ...p, hours_included: e.target.value }))} />
                  <Input placeholder="Staff #" type="number" className="h-8 text-sm" value={pkgForm.staffing_count} onChange={e => setPkgForm(p => ({ ...p, staffing_count: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePkg} disabled={!pkgForm.name}>Save Package</Button>
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
                      <p className="text-xs text-muted-foreground mt-0.5">{pkg.event_type || 'General'} • {pkg.price_type}</p>
                    </div>
                    {pkg.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{pkg.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {pkg.base_price && <Badge variant="outline" className="text-[10px]"><DollarSign className="h-3 w-3 mr-0.5" />${Number(pkg.base_price).toFixed(0)}</Badge>}
                    {pkg.hours_included && <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />{Number(pkg.hours_included)}h</Badge>}
                    {pkg.staffing_count && <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-0.5" />{pkg.staffing_count} staff</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* MEDIA TAB */}
        <TabsContent value="media" className="space-y-4 mt-4">
          <Card className={media.length === 0 ? 'border-dashed' : ''}>
            <CardContent className="py-8 text-center">
              <Image className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{media.length === 0 ? 'No food media yet' : `${media.length} media items`}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Upload dish photos, bar setups, event reels</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AVAILABILITY TAB */}
        <TabsContent value="availability" className="space-y-4 mt-4">
          <Card className={availability.length === 0 ? 'border-dashed' : ''}>
            <CardContent className="py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{availability.length === 0 ? 'No availability set' : `${availability.length} dates configured`}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Set available dates, blackouts, and max events per day</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
