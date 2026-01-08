/**
 * TopTier Partner Edit Page
 * Full edit form for partner details with database persistence
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Building2, Loader2 } from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function TopTierPartnerEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { partnerId } = useParams<{ partnerId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch real partner from database using canonical partnerId
  const { data: partner, isLoading: isLoadingPartner } = useQuery({
    queryKey: ['crm_partner_edit', partnerId, simulationMode],
    queryFn: async () => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from('crm_partners')
        .select('*')
        .eq('id', partnerId)
        .eq('business_slug', 'toptier-experience')
        .eq('is_simulation', simulationMode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!partnerId,
  });

  const [formData, setFormData] = useState({
    company_name: '',
    partner_category: '',
    state: '',
    city: '',
    pricing_range: '',
    commission_rate: 10,
    contract_status: 'pending',
    contact_name: '',
    phone: '',
    email: '',
    booking_link: '',
    availability_rules: '',
    notes: '',
  });

  // Initialize form data when partner is loaded
  useEffect(() => {
    if (partner) {
      setFormData({
        company_name: partner.company_name || '',
        partner_category: partner.partner_category || '',
        state: partner.state || '',
        city: partner.city || '',
        pricing_range: partner.pricing_range || '',
        commission_rate: partner.commission_rate ?? 10,
        contract_status: partner.contract_status || 'pending',
        contact_name: partner.contact_name || '',
        phone: partner.phone || '',
        email: partner.email || '',
        booking_link: partner.booking_link || '',
        availability_rules: partner.availability_rules || '',
        notes: partner.notes || '',
      });
    }
  }, [partner]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!partnerId) return;

    if (simulationMode) {
      toast.info('Changes not saved in Simulation Mode');
      navigate(`/crm/toptier-experience/partners/profile/${partnerId}`);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('crm_partners')
        .update({
          company_name: formData.company_name,
          partner_category: formData.partner_category,
          state: formData.state,
          city: formData.city,
          pricing_range: formData.pricing_range,
          commission_rate: formData.commission_rate,
          contract_status: formData.contract_status,
          contact_name: formData.contact_name,
          phone: formData.phone,
          email: formData.email,
          booking_link: formData.booking_link,
          availability_rules: formData.availability_rules,
          notes: formData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partnerId);

      if (error) throw error;

      // Invalidate queries to refresh profile data
      queryClient.invalidateQueries({ queryKey: ['crm_partner', partnerId] });
      queryClient.invalidateQueries({ queryKey: ['crm_partner_edit', partnerId] });
      
      toast.success('Partner updated successfully');
      navigate(`/crm/toptier-experience/partners/profile/${partnerId}`);
    } catch (error) {
      console.error('Failed to update partner:', error);
      toast.error('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (isLoadingPartner) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
          <h3 className="font-medium mb-2">Loading partner...</h3>
          <p className="text-sm text-muted-foreground">
            Retrieving partner data for editing
          </p>
        </Card>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Partner not found</h3>
          <p className="text-sm text-muted-foreground">The partner you're trying to edit doesn't exist.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Edit Partner
              {simulationMode && <SimulationBadge />}
            </h1>
            <p className="text-muted-foreground">{partner.company_name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={formData.partner_category} onValueChange={(v) => handleChange('partner_category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TOPTIER_PARTNER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Contract Status</Label>
              <Select value={formData.contract_status} onValueChange={(v) => handleChange('contract_status', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Commission */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Commission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Pricing Range</Label>
              <Input
                value={formData.pricing_range}
                onChange={(e) => handleChange('pricing_range', e.target.value)}
                placeholder="e.g., $500 - $2,000"
              />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                value={formData.commission_rate}
                onChange={(e) => handleChange('commission_rate', parseFloat(e.target.value))}
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label>Booking / Affiliate Link</Label>
              <Input
                value={formData.booking_link}
                onChange={(e) => handleChange('booking_link', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Availability Rules</Label>
              <Textarea
                value={formData.availability_rules}
                onChange={(e) => handleChange('availability_rules', e.target.value)}
                placeholder="e.g., Mon-Fri 9am-6pm, weekends by request"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Primary Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this partner..."
              rows={6}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
