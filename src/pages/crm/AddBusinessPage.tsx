import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBoroughs } from '@/hooks/useBoroughs';
import { useNeighborhoods } from '@/hooks/useNeighborhoods';
import { toast } from 'sonner';
import CRMLayout from './CRMLayout';
import { 
  Building2, Palette, Globe, MapPin, Settings2, 
  Briefcase, ArrowLeft, Save, Image, Phone, Mail, 
  Instagram, Calendar, FileText
} from 'lucide-react';

const BUSINESS_CATEGORIES = [
  'Tobacco', 'Transportation', 'Event Services', 'Cleaning', 
  'Retail', 'Tech', 'Adult', 'Wholesale', 'Funding', 'Food & Beverage', 'Other'
];

const BRAND_TYPES = [
  'Service', 'Retail', 'Wholesale', 'Creator Platform', 'Franchise', 'Mixed'
];

const BUSINESS_MODELS = ['B2B', 'B2C', 'Both'];

export default function AddBusinessPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: boroughs = [] } = useBoroughs();
  const { data: neighborhoods = [] } = useNeighborhoods();

  // Form state
  const [formData, setFormData] = useState({
    // Core Info
    name: '',
    primaryColor: '#6366f1',
    logoUrl: '',
    category: '',
    isActive: true,
    tagline: '',
    shortDescription: '',
    longDescription: '',
    // Brand Identity
    brandBannerUrl: '',
    secondaryColor: '#8b5cf6',
    accentColor: '#f59e0b',
    brandType: '',
    // Contact
    primaryPhone: '',
    secondaryPhone: '',
    businessEmail: '',
    websiteUrl: '',
    socialInstagram: '',
    socialTiktok: '',
    socialFacebook: '',
    socialTwitter: '',
    socialYoutube: '',
    // Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    boroughId: '',
    neighborhoodId: '',
    // Operations
    businessModel: '',
    operatingRegion: '',
    openingDate: '',
    internalNotes: '',
    // System Modules
    useCrm: true,
    useRoutePlanner: false,
    useInventory: false,
    useAffiliates: false,
    useAiCompanion: false,
    useStoreMaster: false,
    requireBrandStores: false,
  });

  const filteredNeighborhoods = neighborhoods.filter(
    n => !formData.boroughId || n.borough_id === formData.boroughId
  );

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createBusinessMutation = useMutation({
    mutationFn: async () => {
      const slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const { error } = await supabase
        .from('businesses')
        .insert({
          name: formData.name,
          slug,
          logo_url: formData.logoUrl || null,
          industry: formData.category || null,
          phone: formData.primaryPhone || null,
          email: formData.businessEmail || null,
          website: formData.websiteUrl || null,
          address: formData.addressLine1 || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zipCode || null,
          is_active: formData.isActive,
          tagline: formData.tagline || null,
          short_description: formData.shortDescription || null,
          long_description: formData.longDescription || null,
          category: formData.category || null,
          brand_type: formData.brandType || null,
          brand_banner_url: formData.brandBannerUrl || null,
          primary_color: formData.primaryColor || null,
          secondary_color: formData.secondaryColor || null,
          accent_color: formData.accentColor || null,
          secondary_phone: formData.secondaryPhone || null,
          social_instagram: formData.socialInstagram || null,
          social_tiktok: formData.socialTiktok || null,
          social_facebook: formData.socialFacebook || null,
          social_twitter: formData.socialTwitter || null,
          social_youtube: formData.socialYoutube || null,
          address_line2: formData.addressLine2 || null,
          borough_id: formData.boroughId || null,
          neighborhood_id: formData.neighborhoodId || null,
          business_model: formData.businessModel || null,
          operating_region: formData.operatingRegion || null,
          opening_date: formData.openingDate || null,
          internal_notes: formData.internalNotes || null,
          use_crm: formData.useCrm,
          use_route_planner: formData.useRoutePlanner,
          use_inventory: formData.useInventory,
          use_affiliates: formData.useAffiliates,
          use_ai_companion: formData.useAiCompanion,
          use_store_master: formData.useStoreMaster,
          require_brand_stores: formData.requireBrandStores,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-businesses-all'] });
      toast.success('Business created successfully');
      navigate('/crm');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Business name is required');
      return;
    }
    createBusinessMutation.mutate();
  };

  return (
    <CRMLayout title="Add Business">
      <form onSubmit={handleSubmit} className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/crm')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Add New Business</h1>
              <p className="text-muted-foreground">
                Onboard a new company into OS Dynasty
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Core Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  Core Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Business Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g. GasMask"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => updateField('category', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="primaryColor"
                        value={formData.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        placeholder="#6366f1"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={formData.logoUrl}
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={formData.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Your brand slogan"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short Description</Label>
                  <Input
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => updateField('shortDescription', e.target.value)}
                    placeholder="Brief one-liner about the business"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longDescription">Full Description</Label>
                  <Textarea
                    id="longDescription"
                    value={formData.longDescription}
                    onChange={(e) => updateField('longDescription', e.target.value)}
                    placeholder="Detailed business description..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(v) => updateField('isActive', v)}
                  />
                  <Label htmlFor="isActive">Active Business</Label>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Brand Identity */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Palette className="h-5 w-5 text-primary" />
                  Brand Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brandType">Brand Type</Label>
                    <Select value={formData.brandType} onValueChange={(v) => updateField('brandType', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAND_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brandBannerUrl">Banner Image URL</Label>
                    <Input
                      id="brandBannerUrl"
                      value={formData.brandBannerUrl}
                      onChange={(e) => updateField('brandBannerUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="secondaryColor"
                        value={formData.secondaryColor}
                        onChange={(e) => updateField('secondaryColor', e.target.value)}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.secondaryColor}
                        onChange={(e) => updateField('secondaryColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="accentColor"
                        value={formData.accentColor}
                        onChange={(e) => updateField('accentColor', e.target.value)}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.accentColor}
                        onChange={(e) => updateField('accentColor', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Contact / Management */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  Contact & Social
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryPhone">Primary Phone</Label>
                    <Input
                      id="primaryPhone"
                      value={formData.primaryPhone}
                      onChange={(e) => updateField('primaryPhone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryPhone">Secondary Phone</Label>
                    <Input
                      id="secondaryPhone"
                      value={formData.secondaryPhone}
                      onChange={(e) => updateField('secondaryPhone', e.target.value)}
                      placeholder="(555) 987-6543"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">Business Email</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      value={formData.businessEmail}
                      onChange={(e) => updateField('businessEmail', e.target.value)}
                      placeholder="contact@business.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website</Label>
                    <Input
                      id="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={(e) => updateField('websiteUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Label className="text-muted-foreground text-sm mb-3 block">Social Media</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={formData.socialInstagram}
                      onChange={(e) => updateField('socialInstagram', e.target.value)}
                      placeholder="Instagram handle"
                    />
                    <Input
                      value={formData.socialTiktok}
                      onChange={(e) => updateField('socialTiktok', e.target.value)}
                      placeholder="TikTok handle"
                    />
                    <Input
                      value={formData.socialFacebook}
                      onChange={(e) => updateField('socialFacebook', e.target.value)}
                      placeholder="Facebook page"
                    />
                    <Input
                      value={formData.socialTwitter}
                      onChange={(e) => updateField('socialTwitter', e.target.value)}
                      placeholder="Twitter/X handle"
                    />
                    <Input
                      value={formData.socialYoutube}
                      onChange={(e) => updateField('socialYoutube', e.target.value)}
                      placeholder="YouTube channel"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Address */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  Headquarters Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input
                    id="addressLine1"
                    value={formData.addressLine1}
                    onChange={(e) => updateField('addressLine1', e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    value={formData.addressLine2}
                    onChange={(e) => updateField('addressLine2', e.target.value)}
                    placeholder="Suite 100"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      placeholder="NY"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => updateField('zipCode', e.target.value)}
                      placeholder="10001"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="boroughId">Borough</Label>
                    <Select value={formData.boroughId} onValueChange={(v) => {
                      updateField('boroughId', v);
                      updateField('neighborhoodId', '');
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select borough" />
                      </SelectTrigger>
                      <SelectContent>
                        {boroughs.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhoodId">Neighborhood</Label>
                    <Select 
                      value={formData.neighborhoodId} 
                      onValueChange={(v) => updateField('neighborhoodId', v)}
                      disabled={!formData.boroughId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select neighborhood" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredNeighborhoods.map(n => (
                          <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Operations */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Business Operations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="businessModel">Business Model</Label>
                    <Select value={formData.businessModel} onValueChange={(v) => updateField('businessModel', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_MODELS.map(model => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="operatingRegion">Operating Region</Label>
                    <Input
                      id="operatingRegion"
                      value={formData.operatingRegion}
                      onChange={(e) => updateField('operatingRegion', e.target.value)}
                      placeholder="e.g. NYC Metro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openingDate">Opening Date</Label>
                    <Input
                      id="openingDate"
                      type="date"
                      value={formData.openingDate}
                      onChange={(e) => updateField('openingDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internalNotes">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    value={formData.internalNotes}
                    onChange={(e) => updateField('internalNotes', e.target.value)}
                    placeholder="Private notes about this business..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section 6: System Modules */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings2 className="h-5 w-5 text-primary" />
                  System Modules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enable features and integrations for this business
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { key: 'useCrm', label: 'CRM Module', desc: 'Customer relationship management' },
                    { key: 'useStoreMaster', label: 'Store Master', desc: 'Store database & management' },
                    { key: 'useRoutePlanner', label: 'Route Planner', desc: 'Delivery route optimization' },
                    { key: 'useInventory', label: 'Inventory Tracking', desc: 'Stock & inventory management' },
                    { key: 'useAffiliates', label: 'Affiliates Dashboard', desc: 'Ambassador & affiliate tracking' },
                    { key: 'useAiCompanion', label: 'AI Companion', desc: 'AI-powered assistance' },
                    { key: 'requireBrandStores', label: 'Require Brand Stores', desc: 'Link contacts to stores' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                      <Switch
                        id={key}
                        checked={formData[key as keyof typeof formData] as boolean}
                        onCheckedChange={(v) => updateField(key, v)}
                      />
                      <div>
                        <Label htmlFor={key} className="font-medium">{label}</Label>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Preview */}
                  <div className="flex justify-center">
                    {formData.logoUrl ? (
                      <img 
                        src={formData.logoUrl} 
                        alt="Logo preview" 
                        className="w-24 h-24 rounded-xl object-contain border"
                      />
                    ) : (
                      <div 
                        className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-bold"
                        style={{ backgroundColor: formData.primaryColor }}
                      >
                        {formData.name.charAt(0) || '?'}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="text-center">
                    <h3 className="font-bold text-xl">
                      {formData.name || 'Business Name'}
                    </h3>
                    {formData.tagline && (
                      <p className="text-sm text-muted-foreground mt-1">{formData.tagline}</p>
                    )}
                  </div>

                  {/* Color Swatches */}
                  <div className="flex justify-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-background shadow"
                      style={{ backgroundColor: formData.primaryColor }}
                      title="Primary"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-background shadow"
                      style={{ backgroundColor: formData.secondaryColor }}
                      title="Secondary"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-background shadow"
                      style={{ backgroundColor: formData.accentColor }}
                      title="Accent"
                    />
                  </div>

                  {/* Meta Info */}
                  <div className="space-y-2 text-sm">
                    {formData.category && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category</span>
                        <span className="font-medium">{formData.category}</span>
                      </div>
                    )}
                    {formData.brandType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium">{formData.brandType}</span>
                      </div>
                    )}
                    {formData.businessModel && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-medium">{formData.businessModel}</span>
                      </div>
                    )}
                  </div>

                  {/* Active Status */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${formData.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm">{formData.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
          <div className="max-w-7xl mx-auto flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/crm')}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBusinessMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {createBusinessMutation.isPending ? 'Creating...' : 'Create Business'}
            </Button>
          </div>
        </div>
      </form>
    </CRMLayout>
  );
}
