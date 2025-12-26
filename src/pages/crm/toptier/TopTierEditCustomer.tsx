/**
 * TopTier Edit Customer - Edit existing customer
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, User, MapPin, Settings, Shield, Globe, Instagram, Twitter, Facebook, Cake, ExternalLink } from 'lucide-react';
import { US_STATES, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';
import { differenceInYears, format } from 'date-fns';

export default function TopTierEditCustomer() {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const { simulationMode } = useSimulationMode();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    preferred_contact: 'call',
    dob: '',
    primary_state: '',
    cities: '',
    travel_willingness: 'local',
    customer_type: 'new',
    preferred_categories: [] as string[],
    budget_range: '',
    event_frequency: 'one-time',
    social_instagram: '',
    social_tiktok: '',
    social_twitter: '',
    social_facebook: '',
    social_other_label: '',
    social_other_url: '',
    sms_opt_in: true,
    email_opt_in: true,
    consent_notes: '',
    sales_notes: '',
    preferences: '',
    is_vip: false,
  });

  useEffect(() => {
    // Load customer data (simulated)
    setTimeout(() => {
      setFormData({
        full_name: 'Marcus Johnson',
        phone: '+1 305-555-0123',
        email: 'marcus.johnson@email.com',
        preferred_contact: 'call',
        dob: '1988-05-15',
        primary_state: 'FL',
        cities: 'Miami, Fort Lauderdale',
        travel_willingness: 'multi-state',
        customer_type: 'returning',
        preferred_categories: ['exotic_rental_car_promo', 'yachts'],
        budget_range: '$5,000 - $15,000',
        event_frequency: 'recurring',
        social_instagram: '@marcusjohnson',
        social_tiktok: '@marcusj',
        social_twitter: '@marcusjohnson',
        social_facebook: 'https://facebook.com/marcusjohnson',
        social_other_label: 'LinkedIn',
        social_other_url: 'https://linkedin.com/in/marcusjohnson',
        sms_opt_in: true,
        email_opt_in: true,
        consent_notes: '',
        sales_notes: 'Prefers luxury experiences, repeat customer',
        preferences: 'Likes yacht trips, has used our exotic car rentals multiple times',
        is_vip: true,
      });
      setIsLoading(false);
    }, 500);
  }, [customerId]);

  // Helper to normalize social handle to URL
  const getSocialUrl = (platform: string, handle: string) => {
    if (!handle) return '';
    if (handle.startsWith('http')) return handle;
    const cleanHandle = handle.replace('@', '');
    switch (platform) {
      case 'instagram': return `https://instagram.com/${cleanHandle}`;
      case 'tiktok': return `https://tiktok.com/@${cleanHandle}`;
      case 'twitter': return `https://x.com/${cleanHandle}`;
      case 'facebook': return handle.startsWith('http') ? handle : `https://facebook.com/${cleanHandle}`;
      default: return handle;
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_categories: prev.preferred_categories.includes(category)
        ? prev.preferred_categories.filter(c => c !== category)
        : [...prev.preferred_categories, category]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.phone || !formData.email) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      if (simulationMode) {
        toast.success('Customer updated (Simulation Mode)');
      } else {
        toast.success('Customer updated successfully');
      }
      navigate(`/crm/toptier-experience/customers/${customerId}`);
    } catch (error) {
      toast.error('Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate(`/crm/toptier-experience/customers/${customerId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>
        
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Edit Customer</h1>
          {simulationMode && <SimulationBadge />}
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_contact">Preferred Contact Method</Label>
            <Select value={formData.preferred_contact} onValueChange={(v) => handleChange('preferred_contact', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="text">Text Message</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Cake className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleChange('dob', e.target.value)}
                  className="pl-10"
                />
              </div>
              {formData.dob && (
                <span className="text-sm text-muted-foreground">
                  Age: {differenceInYears(new Date(), new Date(formData.dob))}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Social Media
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="social_instagram">Instagram</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                <Input
                  id="social_instagram"
                  value={formData.social_instagram}
                  onChange={(e) => handleChange('social_instagram', e.target.value)}
                  placeholder="@username"
                  className="pl-10"
                />
              </div>
              {formData.social_instagram && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={getSocialUrl('instagram', formData.social_instagram)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_tiktok">TikTok</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                <Input
                  id="social_tiktok"
                  value={formData.social_tiktok}
                  onChange={(e) => handleChange('social_tiktok', e.target.value)}
                  placeholder="@username"
                  className="pl-10"
                />
              </div>
              {formData.social_tiktok && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={getSocialUrl('tiktok', formData.social_tiktok)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_twitter">X / Twitter</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500" />
                <Input
                  id="social_twitter"
                  value={formData.social_twitter}
                  onChange={(e) => handleChange('social_twitter', e.target.value)}
                  placeholder="@username"
                  className="pl-10"
                />
              </div>
              {formData.social_twitter && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={getSocialUrl('twitter', formData.social_twitter)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_facebook">Facebook</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                <Input
                  id="social_facebook"
                  value={formData.social_facebook}
                  onChange={(e) => handleChange('social_facebook', e.target.value)}
                  placeholder="Profile URL"
                  className="pl-10"
                />
              </div>
              {formData.social_facebook && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={getSocialUrl('facebook', formData.social_facebook)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_other_label">Other Platform</Label>
            <Input
              id="social_other_label"
              value={formData.social_other_label}
              onChange={(e) => handleChange('social_other_label', e.target.value)}
              placeholder="e.g., YouTube, LinkedIn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_other_url">Other URL</Label>
            <div className="flex gap-2">
              <Input
                id="social_other_url"
                value={formData.social_other_url}
                onChange={(e) => handleChange('social_other_url', e.target.value)}
                placeholder="https://..."
              />
              {formData.social_other_url && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={formData.social_other_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_state">Primary State</Label>
            <Select value={formData.primary_state} onValueChange={(v) => handleChange('primary_state', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(state => (
                  <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cities">Cities</Label>
            <Input
              id="cities"
              value={formData.cities}
              onChange={(e) => handleChange('cities', e.target.value)}
              placeholder="e.g., Miami, Fort Lauderdale"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="travel_willingness">Travel Willingness</Label>
            <Select value={formData.travel_willingness} onValueChange={(v) => handleChange('travel_willingness', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Only</SelectItem>
                <SelectItem value="multi-state">Multi-State</SelectItem>
                <SelectItem value="nationwide">Nationwide</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customer Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Customer Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="customer_type">Customer Type</Label>
              <Select value={formData.customer_type} onValueChange={(v) => handleChange('customer_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="returning">Returning</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_range">Budget Range</Label>
              <Input
                id="budget_range"
                value={formData.budget_range}
                onChange={(e) => handleChange('budget_range', e.target.value)}
                placeholder="e.g., $5,000 - $10,000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_frequency">Event Frequency</Label>
              <Select value={formData.event_frequency} onValueChange={(v) => handleChange('event_frequency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-Time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preferred Categories</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {TOPTIER_PARTNER_CATEGORIES.slice(0, 9).map(cat => (
                <div key={cat.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={cat.value}
                    checked={formData.preferred_categories.includes(cat.value)}
                    onCheckedChange={() => handleCategoryToggle(cat.value)}
                  />
                  <Label htmlFor={cat.value} className="text-sm cursor-pointer">
                    {cat.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_vip"
              checked={formData.is_vip}
              onCheckedChange={(checked) => handleChange('is_vip', checked)}
            />
            <Label htmlFor="is_vip" className="cursor-pointer">Mark as VIP Customer</Label>
          </div>
        </CardContent>
      </Card>

      {/* Consent & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consent & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms_opt_in"
                checked={formData.sms_opt_in}
                onCheckedChange={(checked) => handleChange('sms_opt_in', checked)}
              />
              <Label htmlFor="sms_opt_in">SMS Opt-In</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email_opt_in"
                checked={formData.email_opt_in}
                onCheckedChange={(checked) => handleChange('email_opt_in', checked)}
              />
              <Label htmlFor="email_opt_in">Email Opt-In</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consent_notes">Consent Notes</Label>
            <Textarea
              id="consent_notes"
              value={formData.consent_notes}
              onChange={(e) => handleChange('consent_notes', e.target.value)}
              placeholder="Any consent-related notes..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Internal Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Internal Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="sales_notes">Sales Notes</Label>
            <Textarea
              id="sales_notes"
              value={formData.sales_notes}
              onChange={(e) => handleChange('sales_notes', e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferences">Preferences</Label>
            <Textarea
              id="preferences"
              value={formData.preferences}
              onChange={(e) => handleChange('preferences', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/customers/${customerId}`)}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
