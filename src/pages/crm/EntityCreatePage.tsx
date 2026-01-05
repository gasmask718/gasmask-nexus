/**
 * Entity Create Page - Create new entities with blueprint-driven forms
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCRMBlueprint } from '@/hooks/useCRMBlueprint';
import { ExtendedEntityType, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CRMLayout from './CRMLayout';
import { ArrowLeft, Save, Building2, Loader2 } from 'lucide-react';

// US States for dropdown
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Contract statuses
const CONTRACT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'expired', label: 'Expired' },
];

export default function EntityCreatePage() {
  const { businessSlug, entityType } = useParams<{ businessSlug: string; entityType: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get blueprint and entity schema
  const { blueprint, businessName, getEntitySchema } = useCRMBlueprint(businessSlug);
  const entitySchema = getEntitySchema(entityType as ExtendedEntityType);

  // Form state for partners
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    partner_category: '',
    state: '',
    city: '',
    commission_rate: '',
    contract_status: 'pending',
    pricing_range: '',
    availability_rules: '',
    booking_link: '',
    notes: '',
  });

  const createPartnerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('Must be logged in');
      
      const { data: result, error } = await supabase
        .from('crm_partners')
        .insert({
          company_name: data.company_name,
          contact_name: data.contact_name || null,
          phone: data.phone || null,
          email: data.email || null,
          partner_category: data.partner_category,
          state: data.state || null,
          city: data.city || null,
          commission_rate: data.commission_rate ? parseFloat(data.commission_rate) : null,
          contract_status: data.contract_status,
          pricing_range: data.pricing_range || null,
          availability_rules: data.availability_rules || null,
          booking_link: data.booking_link || null,
          notes: data.notes || null,
          business_slug: businessSlug,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      toast.success('Partner created successfully!');
      queryClient.invalidateQueries({ queryKey: ['crm_partners'] });
      navigate(`/crm/${businessSlug}/partners/${result.id}`);
    },
    onError: (error: any) => {
      console.error('Error creating partner:', error);
      toast.error(`Failed to create partner: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!formData.partner_category) {
      toast.error('Partner category is required');
      return;
    }

    createPartnerMutation.mutate(formData);
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!entitySchema) {
    return (
      <CRMLayout title="Entity Not Found">
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Entity Type Not Found</h3>
          <p className="text-muted-foreground mb-6">
            The entity type "{entityType}" is not enabled for this business.
          </p>
          <Button onClick={() => navigate(`/crm/${businessSlug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  // Only handle partners for now (the most critical entity type)
  if (entityType !== 'partners') {
    return (
      <CRMLayout title={`Add ${entitySchema.label}`}>
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground mb-6">
            Creating {entitySchema.labelPlural.toLowerCase()} will be available soon.
          </p>
          <Button onClick={() => navigate(`/crm/${businessSlug}/${entityType}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {entitySchema.labelPlural}
          </Button>
        </Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title={`Add ${entitySchema.label} - ${businessName}`}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/${businessSlug}/${entityType}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add New Partner</h1>
            <p className="text-muted-foreground text-sm">Create a new partner for {businessName}</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  placeholder="e.g., Luxury Wheels NYC"
                  required
                />
              </div>

              {/* Partner Category */}
              <div className="space-y-2">
                <Label htmlFor="partner_category">Partner Category *</Label>
                <Select 
                  value={formData.partner_category} 
                  onValueChange={(value) => updateField('partner_category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPTIER_PARTNER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Name */}
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>

              {/* Phone & Email - side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="e.g., 212-555-0101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="e.g., contact@company.com"
                  />
                </div>
              </div>

              {/* Location - State & City */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select 
                    value={formData.state} 
                    onValueChange={(value) => updateField('state', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="e.g., New York"
                  />
                </div>
              </div>

              {/* Commission Rate & Contract Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.commission_rate}
                    onChange={(e) => updateField('commission_rate', e.target.value)}
                    placeholder="e.g., 15"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract_status">Contract Status</Label>
                  <Select 
                    value={formData.contract_status} 
                    onValueChange={(value) => updateField('contract_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pricing Range */}
              <div className="space-y-2">
                <Label htmlFor="pricing_range">Pricing Range</Label>
                <Input
                  id="pricing_range"
                  value={formData.pricing_range}
                  onChange={(e) => updateField('pricing_range', e.target.value)}
                  placeholder="e.g., $500 - $2,500/day"
                />
              </div>

              {/* Availability Rules */}
              <div className="space-y-2">
                <Label htmlFor="availability_rules">Availability Rules</Label>
                <Input
                  id="availability_rules"
                  value={formData.availability_rules}
                  onChange={(e) => updateField('availability_rules', e.target.value)}
                  placeholder="e.g., 48hr advance booking, weekends only"
                />
              </div>

              {/* Booking Link */}
              <div className="space-y-2">
                <Label htmlFor="booking_link">Booking Link</Label>
                <Input
                  id="booking_link"
                  type="url"
                  value={formData.booking_link}
                  onChange={(e) => updateField('booking_link', e.target.value)}
                  placeholder="e.g., https://booking.company.com"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Any additional notes about this partner..."
                  rows={3}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(`/crm/${businessSlug}/${entityType}`)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPartnerMutation.isPending}
                >
                  {createPartnerMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Partner
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}
