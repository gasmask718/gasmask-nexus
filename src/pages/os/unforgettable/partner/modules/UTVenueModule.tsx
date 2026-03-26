import { useState } from 'react';
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
  Plus, Building2, Users, Car, Accessibility, DollarSign, MapPin, 
  Image, Video, Calendar, Package, Eye, Sparkles, Shield, Clock,
  Star, CheckCircle2, AlertCircle, Globe, Phone, Mail, Wifi,
  Music, Camera, UtensilsCrossed, ParkingCircle
} from 'lucide-react';
import { 
  useVenueProfile, useUpsertVenueProfile,
  useVenueSpacesAdvanced, useUpsertVenueSpaceAdvanced,
  useVenueMedia, useAddVenueMedia,
  useVenueAvailability, useUpsertVenueAvailability,
  useVenuePackages, useUpsertVenuePackage
} from '@/hooks/useUTVenuePortal';

interface Props { partnerId: string; }

const SPACE_TYPES = ['ballroom', 'rooftop', 'garden', 'private_room', 'lounge', 'hall', 'patio', 'terrace', 'chapel', 'conference'];
const VENUE_TYPES = ['event_hall', 'banquet_hall', 'hotel', 'restaurant', 'garden_venue', 'rooftop', 'mansion', 'museum', 'warehouse', 'barn'];
const PACKAGE_TYPES = ['hourly', 'half_day', 'full_day', 'wedding', 'birthday', 'corporate', 'quinceañera', 'baby_shower', 'custom'];
const AMENITIES = ['WiFi', 'Sound System', 'Projector', 'Stage', 'Dance Floor', 'Kitchen', 'Bar', 'Coat Check', 'Bridal Suite', 'AV Equipment', 'Tables', 'Chairs', 'Linens', 'Parking', 'Valet', 'Security', 'Elevator'];

export default function UTVenueModule({ partnerId }: Props) {
  const { data: profile, isLoading: profileLoading } = useVenueProfile(partnerId);
  const upsertProfile = useUpsertVenueProfile();
  const { data: spaces = [] } = useVenueSpacesAdvanced(profile?.id);
  const upsertSpace = useUpsertVenueSpaceAdvanced();
  const { data: media = [] } = useVenueMedia(profile?.id);
  const addMedia = useAddVenueMedia();
  const { data: availability = [] } = useVenueAvailability(profile?.id);
  const upsertAvail = useUpsertVenueAvailability();
  const { data: packages = [] } = useVenuePackages(profile?.id);
  const upsertPkg = useUpsertVenuePackage();

  const [activeTab, setActiveTab] = useState('overview');
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [spaceForm, setSpaceForm] = useState<Record<string, any>>({});
  const [profileForm, setProfileForm] = useState<Record<string, any>>({});
  const [pkgForm, setPkgForm] = useState<Record<string, any>>({});
  const [mediaForm, setMediaForm] = useState<Record<string, any>>({});
  const [availForm, setAvailForm] = useState<Record<string, any>>({});
  const [profileEditing, setProfileEditing] = useState(false);

  // Readiness score calculation
  const readiness = (() => {
    let score = 0; const reasons: string[] = [];
    if (profile?.venue_name) score += 10; else reasons.push('Venue name missing');
    if (profile?.full_description) score += 10; else reasons.push('Description missing');
    if (profile?.full_address) score += 10; else reasons.push('Address missing');
    if (profile?.capacity_max) score += 10; else reasons.push('Capacity missing');
    if (profile?.price_range_min) score += 5; else reasons.push('Pricing missing');
    if (spaces.length > 0) score += 15; else reasons.push('No spaces added');
    if (media.length > 0) score += 15; else reasons.push('No media uploaded');
    if (media.some(m => m.is_cover)) score += 5; else reasons.push('No cover image');
    if (packages.length > 0) score += 10; else reasons.push('No packages defined');
    if (profile?.cancellation_policy) score += 5; else reasons.push('Cancellation policy missing');
    if (profile?.house_rules) score += 5; else reasons.push('House rules missing');
    return { score, reasons };
  })();

  const saveProfile = () => {
    upsertProfile.mutate({ ...profileForm, partner_id: partnerId }, {
      onSuccess: () => setProfileEditing(false)
    });
  };

  const saveSpace = () => {
    if (!profile?.id) { toast('Create venue profile first'); return; }
    upsertSpace.mutate({ ...spaceForm, venue_id: profile.id }, {
      onSuccess: () => { setSpaceOpen(false); setSpaceForm({}); }
    });
  };

  const savePkg = () => {
    if (!profile?.id) return;
    upsertPkg.mutate({ ...pkgForm, venue_id: profile.id }, {
      onSuccess: () => { setPkgOpen(false); setPkgForm({}); }
    });
  };

  const saveMedia = () => {
    if (!profile?.id) return;
    addMedia.mutate({ ...mediaForm, venue_id: profile.id }, {
      onSuccess: () => { setMediaOpen(false); setMediaForm({}); }
    });
  };

  const saveAvail = () => {
    if (!profile?.id) return;
    upsertAvail.mutate({ ...availForm, venue_id: profile.id }, {
      onSuccess: () => { setAvailOpen(false); setAvailForm({}); }
    });
  };

  return (
    <div className="space-y-4">
      {/* Readiness Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Venue Publish Readiness</span>
            </div>
            <Badge variant={readiness.score >= 80 ? 'default' : readiness.score >= 50 ? 'secondary' : 'destructive'}>
              {readiness.score}%
            </Badge>
          </div>
          <Progress value={readiness.score} className="h-2 mb-2" />
          {readiness.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {readiness.reasons.slice(0, 4).map(r => (
                <Badge key={r} variant="outline" className="text-[10px] text-muted-foreground">
                  <AlertCircle className="h-2.5 w-2.5 mr-1" /> {r}
                </Badge>
              ))}
              {readiness.reasons.length > 4 && (
                <Badge variant="outline" className="text-[10px]">+{readiness.reasons.length - 4} more</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {[
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'profile', label: 'Venue Profile', icon: MapPin },
            { id: 'spaces', label: 'Spaces', icon: Users },
            { id: 'media', label: 'Media', icon: Image },
            { id: 'tours', label: 'Tours', icon: Video },
            { id: 'packages', label: 'Packages', icon: Package },
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
              { label: 'Spaces', value: spaces.length, icon: Building2, color: 'text-blue-500' },
              { label: 'Media', value: media.length, icon: Image, color: 'text-purple-500' },
              { label: 'Packages', value: packages.length, icon: Package, color: 'text-amber-500' },
              { label: 'Max Capacity', value: profile?.capacity_max || '—', icon: Users, color: 'text-emerald-500' },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-2xl font-bold mt-1">{s.value}</p>
                    </div>
                    <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* VENUE PROFILE */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Venue Details</CardTitle>
                {!profileEditing ? (
                  <Button size="sm" variant="outline" onClick={() => {
                    setProfileForm(profile || {});
                    setProfileEditing(true);
                  }}>Edit Profile</Button>
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
                    <div className="space-y-2">
                      <Label>Venue Name</Label>
                      <Input value={profileForm.venue_name || ''} onChange={e => setProfileForm(p => ({ ...p, venue_name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Venue Type</Label>
                      <Select value={profileForm.venue_type || 'event_hall'} onValueChange={v => setProfileForm(p => ({ ...p, venue_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VENUE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Headline</Label>
                    <Input value={profileForm.headline || ''} onChange={e => setProfileForm(p => ({ ...p, headline: e.target.value }))} placeholder="A stunning venue for unforgettable events" />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Description</Label>
                    <Textarea rows={4} value={profileForm.full_description || ''} onChange={e => setProfileForm(p => ({ ...p, full_description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Address</Label><Input value={profileForm.full_address || ''} onChange={e => setProfileForm(p => ({ ...p, full_address: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>City</Label><Input value={profileForm.city || ''} onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>State</Label><Input value={profileForm.state || ''} onChange={e => setProfileForm(p => ({ ...p, state: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>ZIP</Label><Input value={profileForm.zip || ''} onChange={e => setProfileForm(p => ({ ...p, zip: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Indoor/Outdoor</Label>
                      <Select value={profileForm.indoor_outdoor || 'indoor'} onValueChange={v => setProfileForm(p => ({ ...p, indoor_outdoor: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indoor">Indoor</SelectItem>
                          <SelectItem value="outdoor">Outdoor</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>Phone</Label><Input value={profileForm.phone || ''} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input value={profileForm.email || ''} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Website</Label><Input value={profileForm.website || ''} onChange={e => setProfileForm(p => ({ ...p, website: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-2"><Label>Min Capacity</Label><Input type="number" value={profileForm.capacity_min || ''} onChange={e => setProfileForm(p => ({ ...p, capacity_min: parseInt(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Max Capacity</Label><Input type="number" value={profileForm.capacity_max || ''} onChange={e => setProfileForm(p => ({ ...p, capacity_max: parseInt(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Price Min ($)</Label><Input type="number" value={profileForm.price_range_min || ''} onChange={e => setProfileForm(p => ({ ...p, price_range_min: parseFloat(e.target.value) }))} /></div>
                    <div className="space-y-2"><Label>Price Max ($)</Label><Input type="number" value={profileForm.price_range_max || ''} onChange={e => setProfileForm(p => ({ ...p, price_range_max: parseFloat(e.target.value) }))} /></div>
                  </div>
                  <div className="space-y-3 border-t pt-3">
                    <h4 className="text-sm font-medium">Policies & Rules</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><Label>Outside Catering</Label><Switch checked={profileForm.outside_catering_allowed ?? true} onCheckedChange={v => setProfileForm(p => ({ ...p, outside_catering_allowed: v }))} /></div>
                        <div className="flex items-center justify-between"><Label>Valet Available</Label><Switch checked={profileForm.valet_available ?? false} onCheckedChange={v => setProfileForm(p => ({ ...p, valet_available: v }))} /></div>
                        <div className="flex items-center justify-between"><Label>Security Required</Label><Switch checked={profileForm.security_required ?? false} onCheckedChange={v => setProfileForm(p => ({ ...p, security_required: v }))} /></div>
                      </div>
                      <div className="space-y-2">
                        <Label>Alcohol Policy</Label>
                        <Textarea rows={2} value={profileForm.alcohol_policy || ''} onChange={e => setProfileForm(p => ({ ...p, alcohol_policy: e.target.value }))} />
                        <Label>Parking Info</Label>
                        <Textarea rows={2} value={profileForm.parking_info || ''} onChange={e => setProfileForm(p => ({ ...p, parking_info: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2"><Label>House Rules</Label><Textarea rows={3} value={profileForm.house_rules || ''} onChange={e => setProfileForm(p => ({ ...p, house_rules: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Cancellation Policy</Label><Textarea rows={3} value={profileForm.cancellation_policy || ''} onChange={e => setProfileForm(p => ({ ...p, cancellation_policy: e.target.value }))} /></div>
                  </div>
                </div>
              ) : profile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold">{profile.venue_name || 'Untitled Venue'}</h3>
                    <Badge variant="outline">{(profile.venue_type || '').replace(/_/g, ' ')}</Badge>
                    {profile.is_published && <Badge className="bg-emerald-500/10 text-emerald-600">Published</Badge>}
                  </div>
                  {profile.headline && <p className="text-sm text-muted-foreground italic">{profile.headline}</p>}
                  {profile.full_address && <p className="text-sm flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.full_address}, {profile.city}, {profile.state} {profile.zip}</p>}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {profile.capacity_max && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {profile.capacity_min || 0}–{profile.capacity_max} guests</span>}
                    {profile.price_range_min && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> ${profile.price_range_min}–${profile.price_range_max}</span>}
                    {profile.valet_available && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Valet</span>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No venue profile yet</p>
                  <Button size="sm" onClick={() => { setProfileForm({}); setProfileEditing(true); }}>Create Venue Profile</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SPACES */}
        <TabsContent value="spaces">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Rentable Spaces ({spaces.length})</h3>
              <Dialog open={spaceOpen} onOpenChange={setSpaceOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Space</Button></DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Venue Space</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Space Name</Label><Input value={spaceForm.name || ''} onChange={e => setSpaceForm(p => ({ ...p, name: e.target.value }))} placeholder="Grand Ballroom" /></div>
                      <div className="space-y-2"><Label>Type</Label>
                        <Select value={spaceForm.space_type || 'hall'} onValueChange={v => setSpaceForm(p => ({ ...p, space_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{SPACE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={spaceForm.description || ''} onChange={e => setSpaceForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2"><Label>Seated</Label><Input type="number" value={spaceForm.seated_capacity || ''} onChange={e => setSpaceForm(p => ({ ...p, seated_capacity: parseInt(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Standing</Label><Input type="number" value={spaceForm.standing_capacity || ''} onChange={e => setSpaceForm(p => ({ ...p, standing_capacity: parseInt(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Min Hours</Label><Input type="number" value={spaceForm.minimum_hours || 4} onChange={e => setSpaceForm(p => ({ ...p, minimum_hours: parseInt(e.target.value) }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Min Price ($)</Label><Input type="number" value={spaceForm.min_price || ''} onChange={e => setSpaceForm(p => ({ ...p, min_price: parseFloat(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Max Price ($)</Label><Input type="number" value={spaceForm.max_price || ''} onChange={e => setSpaceForm(p => ({ ...p, max_price: parseFloat(e.target.value) }))} /></div>
                    </div>
                    <div className="flex items-center justify-between"><Label>Primary Space</Label><Switch checked={spaceForm.is_primary ?? false} onCheckedChange={v => setSpaceForm(p => ({ ...p, is_primary: v }))} /></div>
                    <Button onClick={saveSpace} disabled={upsertSpace.isPending} className="w-full">Save Space</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {spaces.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No spaces yet</p></CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {spaces.map(s => (
                  <Card key={s.id} className={`border-border/50 ${s.is_primary ? 'ring-1 ring-primary/30' : ''}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm">{s.name}</h4>
                        <div className="flex gap-1">
                          {s.is_primary && <Badge className="text-[10px] bg-primary/10 text-primary">Primary</Badge>}
                          <Badge variant="outline" className="text-[10px]">{(s.space_type || '').replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{s.description}</p>}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {s.seated_capacity && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {s.seated_capacity} seated</span>}
                        {s.standing_capacity && <span>{s.standing_capacity} standing</span>}
                        {s.min_price && <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" /> ${Number(s.min_price).toLocaleString()}–${Number(s.max_price).toLocaleString()}</span>}
                        {s.minimum_hours && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {s.minimum_hours}h min</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* MEDIA */}
        <TabsContent value="media">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Venue Media ({media.length})</h3>
              <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Media</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Media</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>File URL</Label><Input value={mediaForm.file_url || ''} onChange={e => setMediaForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://..." /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Type</Label>
                        <Select value={mediaForm.media_type || 'image'} onValueChange={v => setMediaForm(p => ({ ...p, media_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="tour">3D Tour</SelectItem>
                            <SelectItem value="floorplan">Floor Plan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Space (optional)</Label>
                        <Select value={mediaForm.space_id || 'none'} onValueChange={v => setMediaForm(p => ({ ...p, space_id: v === 'none' ? null : v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Venue-wide</SelectItem>
                            {spaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Title</Label><Input value={mediaForm.title || ''} onChange={e => setMediaForm(p => ({ ...p, title: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Caption</Label><Input value={mediaForm.caption || ''} onChange={e => setMediaForm(p => ({ ...p, caption: e.target.value }))} /></div>
                    </div>
                    <div className="flex items-center justify-between"><Label>Set as Cover Image</Label><Switch checked={mediaForm.is_cover ?? false} onCheckedChange={v => setMediaForm(p => ({ ...p, is_cover: v }))} /></div>
                    <Button onClick={saveMedia} disabled={addMedia.isPending} className="w-full">Add Media</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {media.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Image className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No media yet. Upload photos, videos, and floor plans.</p></CardContent></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {media.map(m => (
                  <Card key={m.id} className="border-border/50 overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      {m.media_type === 'image' && m.file_url ? (
                        <img src={m.file_url} alt={m.title || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          {m.media_type === 'video' ? <Video className="h-8 w-8 text-muted-foreground/40" /> : <Image className="h-8 w-8 text-muted-foreground/40" />}
                        </div>
                      )}
                      {m.is_cover && <Badge className="absolute top-2 left-2 text-[10px]">Cover</Badge>}
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-background/80">{m.media_type}</Badge>
                    </div>
                    <CardContent className="pt-2 pb-2">
                      <p className="text-xs font-medium truncate">{m.title || 'Untitled'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TOURS */}
        <TabsContent value="tours">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">3D Tours & Walkthroughs</CardTitle></CardHeader>
            <CardContent>
              {profile?.tour_embed_url ? (
                <div className="space-y-3">
                  <Badge variant="outline">{profile.tour_type || 'Virtual Tour'}</Badge>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <iframe src={profile.tour_embed_url} className="w-full h-full" allowFullScreen title="Virtual Tour" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Add a Matterport, YouTube, or custom tour URL in the venue profile</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PACKAGES */}
        <TabsContent value="packages">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Venue Packages ({packages.length})</h3>
              <Dialog open={pkgOpen} onOpenChange={setPkgOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Package</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Package</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Package Name</Label><Input value={pkgForm.package_name || ''} onChange={e => setPkgForm(p => ({ ...p, package_name: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Type</Label>
                        <Select value={pkgForm.package_type || 'custom'} onValueChange={v => setPkgForm(p => ({ ...p, package_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PACKAGE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Description</Label><Textarea value={pkgForm.description || ''} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Price ($)</Label><Input type="number" value={pkgForm.price || ''} onChange={e => setPkgForm(p => ({ ...p, price: parseFloat(e.target.value) }))} /></div>
                      <div className="space-y-2"><Label>Space (optional)</Label>
                        <Select value={pkgForm.space_id || 'none'} onValueChange={v => setPkgForm(p => ({ ...p, space_id: v === 'none' ? null : v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Any Space</SelectItem>
                            {spaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between"><Label>Featured</Label><Switch checked={pkgForm.is_featured ?? false} onCheckedChange={v => setPkgForm(p => ({ ...p, is_featured: v }))} /></div>
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
                        <h4 className="font-semibold text-sm">{pkg.package_name}</h4>
                        <div className="flex gap-1">
                          {pkg.is_featured && <Badge className="text-[10px] bg-amber-500/10 text-amber-600"><Star className="h-2.5 w-2.5 mr-0.5" /> Featured</Badge>}
                          <Badge variant="outline" className="text-[10px]">{(pkg.package_type || '').replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>
                      {pkg.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{pkg.description}</p>}
                      {pkg.price && <p className="text-sm font-bold text-primary">${Number(pkg.price).toLocaleString()}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AVAILABILITY */}
        <TabsContent value="availability">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Availability & Blackout Dates</h3>
              <Dialog open={availOpen} onOpenChange={setAvailOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Date</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Set Availability</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={availForm.available_date || ''} onChange={e => setAvailForm(p => ({ ...p, available_date: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={availForm.start_time || ''} onChange={e => setAvailForm(p => ({ ...p, start_time: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>End Time</Label><Input type="time" value={availForm.end_time || ''} onChange={e => setAvailForm(p => ({ ...p, end_time: e.target.value }))} /></div>
                    </div>
                    <div className="space-y-2"><Label>Status</Label>
                      <Select value={availForm.status || 'available'} onValueChange={v => setAvailForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="tentative">Tentative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Note</Label><Input value={availForm.note || ''} onChange={e => setAvailForm(p => ({ ...p, note: e.target.value }))} /></div>
                    <Button onClick={saveAvail} disabled={upsertAvail.isPending} className="w-full">Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {availability.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center"><Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No availability entries</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {availability.map(a => (
                  <Card key={a.id} className="border-border/50">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.available_date}</span>
                        {a.start_time && <span className="text-xs text-muted-foreground">{a.start_time}–{a.end_time}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {a.note && <span className="text-xs text-muted-foreground">{a.note}</span>}
                        <Badge variant={a.status === 'available' ? 'default' : a.status === 'blocked' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {a.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* PUBLISH PREVIEW */}
        <TabsContent value="preview">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Listing Preview</CardTitle></CardHeader>
            <CardContent>
              {profile ? (
                <div className="space-y-4">
                  {/* Hero */}
                  <div className="aspect-[21/9] bg-muted rounded-xl overflow-hidden relative">
                    {media.find(m => m.is_cover) ? (
                      <img src={media.find(m => m.is_cover)!.file_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><Image className="h-12 w-12 text-muted-foreground/30" /></div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                      <h2 className="text-white text-2xl font-bold">{profile.venue_name}</h2>
                      <p className="text-white/80 text-sm">{profile.headline}</p>
                    </div>
                  </div>
                  {/* Details */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Capacity</p>
                      <p className="font-bold">{profile.capacity_max || '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Starting At</p>
                      <p className="font-bold">{profile.price_range_min ? `$${Number(profile.price_range_min).toLocaleString()}` : '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Spaces</p>
                      <p className="font-bold">{spaces.length}</p>
                    </div>
                  </div>
                  {/* Spaces preview */}
                  {spaces.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Available Spaces</h4>
                      <div className="grid gap-2 md:grid-cols-2">
                        {spaces.map(s => (
                          <div key={s.id} className="p-3 rounded-lg border border-border/50 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.seated_capacity} seated • {(s.space_type || '').replace(/_/g, ' ')}</p>
                            </div>
                            {s.min_price && <p className="text-sm font-bold text-primary">from ${Number(s.min_price).toLocaleString()}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12"><p className="text-muted-foreground">Create a venue profile to see preview</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toast(msg: string) {
  // Simple fallback — real toast imported from sonner in hooks
  console.warn(msg);
}
