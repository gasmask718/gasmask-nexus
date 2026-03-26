import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, Package, DollarSign, Hash, Upload, FileSpreadsheet,
  Image, Eye, AlertCircle, Star, Search, Filter, Layers,
  Truck, Wrench, Calendar, CheckCircle2, X, ArrowUpDown
} from 'lucide-react';
import { 
  useRentalProfile, useUpsertRentalProfile,
  useRentalItemsAdvanced, useUpsertRentalItemAdvanced, useBulkInsertRentalItems,
  useRentalPackagesAdvanced, useUpsertRentalPackage,
} from '@/hooks/useUTRentalPortal';

interface Props { partnerId: string; }

const RENTAL_CATEGORIES = [
  'chairs', 'tables', 'tents', 'bounce_houses', 'linens', 'throne_chairs',
  'backdrops', 'centerpieces', 'props', 'lighting', 'photo_booths',
  'decor_rentals', 'tableware', 'bars', 'staging', 'other'
];

export default function UTRentalModule({ partnerId }: Props) {
  const { data: profile } = useRentalProfile(partnerId);
  const upsertProfile = useUpsertRentalProfile();
  const { data: items = [] } = useRentalItemsAdvanced(partnerId);
  const upsertItem = useUpsertRentalItemAdvanced();
  const bulkInsert = useBulkInsertRentalItems();
  const { data: packages = [] } = useRentalPackagesAdvanced(partnerId);
  const upsertPkg = useUpsertRentalPackage();

  const [activeTab, setActiveTab] = useState('overview');
  const [itemOpen, setItemOpen] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [itemForm, setItemForm] = useState<Record<string, any>>({});
  const [profileForm, setProfileForm] = useState<Record<string, any>>({});
  const [pkgForm, setPkgForm] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [csvPreview, setCsvPreview] = useState<Record<string, any>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const filtered = items
    .filter(i => filter === 'all' || i.category === filter)
    .filter(i => !search || i.item_name?.toLowerCase().includes(search.toLowerCase()));

  const totalValue = items.reduce((s, i) => s + (Number(i.rental_price) || 0) * (i.quantity_available || 0), 0);
  const totalItems = items.reduce((s, i) => s + (i.quantity_available || 0), 0);

  // Readiness
  const readiness = (() => {
    let score = 0; const reasons: string[] = [];
    if (profile?.company_name) score += 15; else reasons.push('Company name missing');
    if (profile?.description) score += 10; else reasons.push('Description missing');
    if (profile?.delivery_policy) score += 10; else reasons.push('Delivery policy missing');
    if (items.length > 0) score += 20; else reasons.push('No inventory items');
    if (items.length >= 10) score += 10; else reasons.push('Less than 10 items');
    if (items.every(i => i.rental_price)) score += 10; else reasons.push('Some items missing price');
    if (packages.length > 0) score += 15; else reasons.push('No packages defined');
    if (profile?.deposit_policy) score += 5; else reasons.push('Deposit policy missing');
    if (profile?.damage_policy) score += 5; else reasons.push('Damage policy missing');
    return { score, reasons };
  })();

  const saveProfile = () => {
    upsertProfile.mutate({ ...profileForm, partner_id: partnerId }, { onSuccess: () => setProfileEditing(false) });
  };

  const saveItem = () => {
    upsertItem.mutate({ ...itemForm, partner_id: partnerId }, { onSuccess: () => { setItemOpen(false); setItemForm({}); } });
  };

  const savePkg = () => {
    upsertPkg.mutate({ ...pkgForm, partner_id: partnerId }, { onSuccess: () => { setPkgOpen(false); setPkgForm({}); } });
  };

  // CSV Import
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const row: Record<string, any> = { partner_id: partnerId };
        headers.forEach((h, i) => {
          if (['quantity_available', 'quantity_reserved'].includes(h)) row[h] = parseInt(vals[i]) || 0;
          else if (['rental_price', 'delivery_fee', 'setup_fee', 'cleaning_fee', 'cost_basis', 'replacement_value'].includes(h)) row[h] = parseFloat(vals[i]) || 0;
          else row[h] = vals[i] || null;
        });
        return row;
      });
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!csvPreview) return;
    bulkInsert.mutate(csvPreview, { onSuccess: () => setCsvPreview(null) });
  };

  return (
    <div className="space-y-4">
      {/* Readiness Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Rental Catalog Readiness</span>
            </div>
            <Badge variant={readiness.score >= 80 ? 'default' : readiness.score >= 50 ? 'secondary' : 'destructive'}>{readiness.score}%</Badge>
          </div>
          <Progress value={readiness.score} className="h-2 mb-2" />
          {readiness.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {readiness.reasons.slice(0, 4).map(r => (
                <Badge key={r} variant="outline" className="text-[10px] text-muted-foreground"><AlertCircle className="h-2.5 w-2.5 mr-1" /> {r}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'profile', label: 'Company', icon: Package },
            { id: 'inventory', label: 'Inventory', icon: Hash },
            { id: 'upload', label: 'Bulk Upload', icon: Upload },
            { id: 'media', label: 'Media', icon: Image },
            { id: 'packages', label: 'Packages', icon: Star },
            { id: 'availability', label: 'Availability', icon: Calendar },
            { id: 'preview', label: 'Preview', icon: Eye },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Unique Items', value: items.length, icon: Package, color: 'text-blue-500' },
              { label: 'Total Units', value: totalItems, icon: Hash, color: 'text-purple-500' },
              { label: 'Categories', value: categories.length, icon: Layers, color: 'text-amber-500' },
              { label: 'Catalog Value', value: `$${totalValue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold mt-1">{s.value}</p></div>
                    <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* COMPANY PROFILE */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Company Profile</CardTitle>
                {!profileEditing ? (
                  <Button size="sm" variant="outline" onClick={() => { setProfileForm(profile || {}); setProfileEditing(true); }}>Edit</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setProfileEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={saveProfile} disabled={upsertProfile.isPending}>Save</Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profileEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Company Name</Label><Input value={profileForm.company_name || ''} onChange={e => setProfileForm(p => ({ ...p, company_name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Service Radius (miles)</Label><Input type="number" value={profileForm.service_radius || ''} onChange={e => setProfileForm(p => ({ ...p, service_radius: parseInt(e.target.value) }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Headline</Label><Input value={profileForm.headline || ''} onChange={e => setProfileForm(p => ({ ...p, headline: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={profileForm.description || ''} onChange={e => setProfileForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Min Order ($)</Label><Input type="number" value={profileForm.minimum_order_amount || 0} onChange={e => setProfileForm(p => ({ ...p, minimum_order_amount: parseFloat(e.target.value) }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Delivery Policy</Label><Textarea rows={2} value={profileForm.delivery_policy || ''} onChange={e => setProfileForm(p => ({ ...p, delivery_policy: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Setup Policy</Label><Textarea rows={2} value={profileForm.setup_policy || ''} onChange={e => setProfileForm(p => ({ ...p, setup_policy: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Deposit Policy</Label><Textarea rows={2} value={profileForm.deposit_policy || ''} onChange={e => setProfileForm(p => ({ ...p, deposit_policy: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Damage Policy</Label><Textarea rows={2} value={profileForm.damage_policy || ''} onChange={e => setProfileForm(p => ({ ...p, damage_policy: e.target.value }))} /></div>
                  </div>
                </div>
              ) : profile ? (
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">{profile.company_name}</h3>
                  {profile.headline && <p className="text-sm text-muted-foreground italic">{profile.headline}</p>}
                  {profile.description && <p className="text-sm">{profile.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {profile.service_radius && <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {profile.service_radius} mi radius</span>}
                    {profile.minimum_order_amount && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> ${profile.minimum_order_amount} minimum</span>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No rental profile yet</p>
                  <Button size="sm" onClick={() => { setProfileForm({}); setProfileEditing(true); }}>Create Profile</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVENTORY */}
        <TabsContent value="inventory">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <div className="relative flex-1 max-w-xs">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input className="pl-8 h-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <Dialog open={itemOpen} onOpenChange={setItemOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Item</Button></DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Item Name</Label><Input value={itemForm.item_name || ''} onChange={e => setItemForm(p => ({ ...p, item_name: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>SKU</Label><Input value={itemForm.sku || ''} onChange={e => setItemForm(p => ({ ...p, sku: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Category</Label>
                        <Select value={itemForm.category || 'other'} onValueChange={v => setItemForm(p => ({ ...p, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{RENTAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Subcategory</Label><Input value={itemForm.subcategory || ''} onChange={e => setItemForm(p => ({ ...p, subcategory: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={itemForm.description || ''} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2"><Label>Color</Label><Input value={itemForm.color || ''} onChange={e => setItemForm(p => ({ ...p, color: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Style</Label><Input value={itemForm.style || ''} onChange={e => setItemForm(p => ({ ...p, style: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Material</Label><Input value={itemForm.material || ''} onChange={e => setItemForm(p => ({ ...p, material: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2"><Label>Rental Price ($)</Label><Input type="number" value={itemForm.rental_price || ''} onChange={e => setItemForm(p => ({ ...p, rental_price: parseFloat(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Qty Available</Label><Input type="number" value={itemForm.quantity_available || 1} onChange={e => setItemForm(p => ({ ...p, quantity_available: parseInt(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Replacement ($)</Label><Input type="number" value={itemForm.replacement_value || ''} onChange={e => setItemForm(p => ({ ...p, replacement_value: parseFloat(e.target.value) }))} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2"><Label>Delivery Fee</Label><Input type="number" value={itemForm.delivery_fee || 0} onChange={e => setItemForm(p => ({ ...p, delivery_fee: parseFloat(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Setup Fee</Label><Input type="number" value={itemForm.setup_fee || 0} onChange={e => setItemForm(p => ({ ...p, setup_fee: parseFloat(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Cleaning Fee</Label><Input type="number" value={itemForm.cleaning_fee || 0} onChange={e => setItemForm(p => ({ ...p, cleaning_fee: parseFloat(e.target.value) }))} /></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2"><Label>Setup Required</Label><Switch checked={itemForm.setup_required ?? false} onCheckedChange={v => setItemForm(p => ({ ...p, setup_required: v }))} /></div>
                      <div className="flex items-center gap-2"><Label>Delivery Required</Label><Switch checked={itemForm.delivery_required ?? false} onCheckedChange={v => setItemForm(p => ({ ...p, delivery_required: v }))} /></div>
                      <div className="flex items-center gap-2"><Label>Featured</Label><Switch checked={itemForm.is_featured ?? false} onCheckedChange={v => setItemForm(p => ({ ...p, is_featured: v }))} /></div>
                    </div>
                    <Button onClick={saveItem} disabled={upsertItem.isPending} className="w-full">Save Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Category Filters */}
            {categories.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilter('all')}>All ({items.length})</Badge>
                {categories.map(cat => (
                  <Badge key={cat} variant={filter === cat ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => setFilter(cat!)}>
                    {(cat || '').replace(/_/g, ' ')} ({items.filter(i => i.category === cat).length})
                  </Badge>
                ))}
              </div>
            )}

            {/* Items Grid */}
            {filtered.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No items</p></CardContent></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(item => (
                  <Card key={item.id} className={`border-border/50 ${item.is_featured ? 'ring-1 ring-amber-500/20' : ''}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-sm">{item.item_name}</h4>
                        <div className="flex gap-1">
                          {item.is_featured && <Star className="h-3.5 w-3.5 text-amber-500" />}
                          <Badge variant="outline" className="text-[10px]">{(item.category || '').replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{item.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.rental_price != null && <span className="font-medium text-foreground flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{Number(item.rental_price).toFixed(2)}</span>}
                        <span className="flex items-center gap-0.5"><Hash className="h-3 w-3" />{item.quantity_available} avail</span>
                        {item.color && <span>{item.color}</span>}
                        {item.sku && <span className="font-mono text-[10px]">{item.sku}</span>}
                        {item.setup_required && <Wrench className="h-3 w-3 text-orange-500" />}
                        {item.delivery_required && <Truck className="h-3 w-3 text-blue-500" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* BULK UPLOAD */}
        <TabsContent value="upload">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> CSV Inventory Import</CardTitle></CardHeader>
            <CardContent>
              {!csvPreview ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-xl p-8 text-center">
                    <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">Upload a CSV file with your inventory</p>
                    <p className="text-xs text-muted-foreground mb-4">Columns: item_name, category, quantity_available, rental_price, color, style, sku, delivery_fee, setup_fee</p>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
                    <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Select CSV</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{csvPreview.length} items ready to import</h4>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setCsvPreview(null)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                      <Button size="sm" onClick={confirmImport} disabled={bulkInsert.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Import {csvPreview.length} Items
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Category</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-left p-2">Color</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0, 50).map((row, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="p-2">{row.item_name}</td>
                            <td className="p-2">{row.category}</td>
                            <td className="p-2 text-right">{row.quantity_available}</td>
                            <td className="p-2 text-right">${row.rental_price}</td>
                            <td className="p-2">{row.color}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEDIA */}
        <TabsContent value="media">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Image className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Item media management</p>
              <p className="text-xs text-muted-foreground mt-1">Upload images for individual inventory items from the Inventory tab</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PACKAGES */}
        <TabsContent value="packages">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Rental Packages ({packages.length})</h3>
              <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Package</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Rental Package</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Package Name</Label><Input value={pkgForm.name || ''} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="Kids Party Package" /></div>
                      <div className="space-y-2"><Label>Category</Label>
                        <Select value={pkgForm.category || 'other'} onValueChange={v => setPkgForm(p => ({ ...p, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{RENTAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={pkgForm.description || ''} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Package Price ($)</Label><Input type="number" value={pkgForm.package_price || ''} onChange={e => setPkgForm(p => ({ ...p, package_price: parseFloat(e.target.value) }))} /></div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2"><Label>Featured</Label><Switch checked={pkgForm.is_featured ?? false} onCheckedChange={v => setPkgForm(p => ({ ...p, is_featured: v }))} /></div>
                    </div>
                    <Button onClick={savePkg} disabled={upsertPkg.isPending} className="w-full">Save Package</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {packages.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No packages yet</p></CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {packages.map(pkg => (
                  <Card key={pkg.id} className={`border-border/50 ${pkg.is_featured ? 'ring-1 ring-amber-500/30' : ''}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm">{pkg.name}</h4>
                        {pkg.is_featured && <Badge className="text-[10px] bg-amber-500/10 text-amber-600"><Star className="h-2.5 w-2.5 mr-0.5" /> Featured</Badge>}
                      </div>
                      {pkg.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{pkg.description}</p>}
                      {pkg.package_price && <p className="text-sm font-bold text-primary">${Number(pkg.package_price).toLocaleString()}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AVAILABILITY */}
        <TabsContent value="availability">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Rental availability is managed per-item via reservations</p>
              <p className="text-xs text-muted-foreground mt-1">When bookings are created, item quantities are automatically reserved</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREVIEW */}
        <TabsContent value="preview">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Listing Preview</CardTitle></CardHeader>
            <CardContent>
              {profile ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5">
                    <h2 className="text-xl font-bold">{profile.company_name}</h2>
                    {profile.headline && <p className="text-sm text-muted-foreground mt-1">{profile.headline}</p>}
                    <div className="flex flex-wrap gap-3 mt-3 text-sm">
                      <Badge variant="secondary">{items.length} items</Badge>
                      {profile.service_radius && <Badge variant="outline">{profile.service_radius} mi delivery</Badge>}
                      {profile.minimum_order_amount && <Badge variant="outline">${profile.minimum_order_amount} minimum</Badge>}
                    </div>
                  </div>
                  {/* Category grid preview */}
                  {categories.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Browse by Category</h4>
                      <div className="grid gap-2 grid-cols-3 md:grid-cols-4">
                        {categories.map(cat => (
                          <div key={cat} className="p-3 rounded-lg border border-border/50 text-center">
                            <p className="text-sm font-medium">{(cat || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                            <p className="text-xs text-muted-foreground">{items.filter(i => i.category === cat).length} items</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Featured items */}
                  {items.filter(i => i.is_featured).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Featured Items</h4>
                      <div className="grid gap-2 md:grid-cols-3">
                        {items.filter(i => i.is_featured).map(item => (
                          <div key={item.id} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                            <p className="text-sm font-medium">{item.item_name}</p>
                            <p className="text-xs text-muted-foreground">{(item.category || '').replace(/_/g, ' ')}</p>
                            <p className="text-sm font-bold text-primary mt-1">${Number(item.rental_price).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-muted-foreground">Create a company profile to see preview</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
