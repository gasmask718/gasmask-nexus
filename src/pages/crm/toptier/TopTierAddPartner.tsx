/**
 * TopTier Add Partner - Full Detailed Intake Form
 * Enterprise-grade partner onboarding with accordion sections
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Building2, MapPin, DollarSign, User, FileText, 
  Upload, Save, CheckCircle, AlertCircle, Calendar, Phone, Mail,
  Link2, Globe, Briefcase
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES, US_STATES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

// Business Types
const BUSINESS_TYPES = [
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'individual', label: 'Individual / Sole Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'agency', label: 'Agency' },
  { value: 'other', label: 'Other' },
];

// Commission Types
const COMMISSION_TYPES = [
  { value: 'percentage', label: 'Percentage of Sale' },
  { value: 'flat', label: 'Flat Fee per Booking' },
  { value: 'tiered', label: 'Tiered (Volume Based)' },
  { value: 'hybrid', label: 'Hybrid (Base + Percentage)' },
];

// Payout Schedules
const PAYOUT_SCHEDULES = [
  { value: 'per_booking', label: 'Per Booking (After Event)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'net_30', label: 'Net 30' },
];

// Contract Statuses
const CONTRACT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

// Preferred Contact Methods
const CONTACT_METHODS = [
  { value: 'phone', label: 'Phone Call' },
  { value: 'text', label: 'Text Message' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

// Availability Status Options
const AVAILABILITY_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited Availability' },
  { value: 'fully_booked', label: 'Fully Booked' },
  { value: 'seasonal', label: 'Seasonal Only' },
  { value: 'on_hold', label: 'On Hold' },
];

export default function TopTierAddPartner() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState(['overview', 'coverage', 'pricing', 'contact']);

  // Form State - Partner Overview
  const [partnerName, setPartnerName] = useState('');
  const [partnerCategory, setPartnerCategory] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [bookingLink, setBookingLink] = useState('');

  // Form State - Coverage & Availability
  const [primaryState, setPrimaryState] = useState('');
  const [statesCovered, setStatesCovered] = useState<string[]>([]);
  const [citiesCovered, setCitiesCovered] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [blackoutDates, setBlackoutDates] = useState('');
  const [serviceRadius, setServiceRadius] = useState('');

  // Form State - Pricing & Commissions
  const [pricingMin, setPricingMin] = useState('');
  const [pricingMax, setPricingMax] = useState('');
  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionRate, setCommissionRate] = useState('');
  const [payoutSchedule, setPayoutSchedule] = useState('per_booking');
  const [pricingNotes, setPricingNotes] = useState('');

  // Form State - Primary Contact
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('phone');

  // Form State - Contract & Status
  const [contractStatus, setContractStatus] = useState('draft');
  const [startDate, setStartDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [riskFlag, setRiskFlag] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');

  const handleStateToggle = (stateValue: string) => {
    setStatesCovered(prev => 
      prev.includes(stateValue)
        ? prev.filter(s => s !== stateValue)
        : [...prev, stateValue]
    );
  };

  const handleSave = async () => {
    // Validation
    if (!partnerName.trim()) {
      toast.error('Partner name is required');
      return;
    }
    if (!partnerCategory) {
      toast.error('Partner category is required');
      return;
    }
    if (!primaryState) {
      toast.error('Primary state is required');
      return;
    }

    setSaving(true);
    
    try {
      if (simulationMode) {
        // Simulation mode - just show success
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Partner created successfully (Simulation Mode)');
        navigate('/crm/toptier-experience/partners');
      } else {
        // TODO: Real API call to save partner
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Partner created successfully');
        navigate('/crm/toptier-experience/partners');
      }
    } catch (error) {
      toast.error('Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  const categoryInfo = TOPTIER_PARTNER_CATEGORIES.find(c => c.value === partnerCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Add New Partner</h1>
                {simulationMode && <SimulationBadge />}
              </div>
              <p className="text-muted-foreground">
                Complete the form below to onboard a new partner organization
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Partner
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Sections */}
      <Accordion 
        type="multiple" 
        value={expandedSections}
        onValueChange={setExpandedSections}
        className="space-y-4"
      >
        {/* Section A: Partner Overview */}
        <AccordionItem value="overview" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Partner Overview</p>
                <p className="text-sm text-muted-foreground">Basic information about the partner</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partnerName">Partner Name *</Label>
                  <Input
                    id="partnerName"
                    placeholder="e.g., Elite Helicopters Miami"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerCategory">Partner Category *</Label>
                  <Select value={partnerCategory} onValueChange={setPartnerCategory}>
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
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="website"
                      placeholder="https://example.com"
                      className="pl-9"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Services Offered</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the services this partner provides..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookingLink">Booking / Affiliate Link</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="bookingLink"
                    placeholder="https://partner.com/book?ref=toptier"
                    className="pl-9"
                    value={bookingLink}
                    onChange={(e) => setBookingLink(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section B: Coverage & Availability */}
        <AccordionItem value="coverage" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Coverage & Availability</p>
                <p className="text-sm text-muted-foreground">Service areas and scheduling</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryState">Primary State *</Label>
                  <Select value={primaryState} onValueChange={setPrimaryState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availabilityStatus">Availability Status</Label>
                  <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>States Covered (Multi-select)</Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                  {US_STATES.map((state) => (
                    <Badge
                      key={state.value}
                      variant={statesCovered.includes(state.value) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => handleStateToggle(state.value)}
                    >
                      {state.value}
                    </Badge>
                  ))}
                </div>
                {statesCovered.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {statesCovered.join(', ')}
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="citiesCovered">Cities Covered</Label>
                  <Input
                    id="citiesCovered"
                    placeholder="Miami, Fort Lauderdale, Palm Beach..."
                    value={citiesCovered}
                    onChange={(e) => setCitiesCovered(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceRadius">Service Radius (miles)</Label>
                  <Input
                    id="serviceRadius"
                    type="number"
                    placeholder="50"
                    value={serviceRadius}
                    onChange={(e) => setServiceRadius(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="blackoutDates">Blackout Dates / Unavailable Periods</Label>
                <Textarea
                  id="blackoutDates"
                  placeholder="e.g., Dec 24-Jan 2, Major holidays, etc."
                  rows={2}
                  value={blackoutDates}
                  onChange={(e) => setBlackoutDates(e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section C: Pricing & Commissions */}
        <AccordionItem value="pricing" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Pricing & Commissions</p>
                <p className="text-sm text-muted-foreground">Rates, fees, and payout terms</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pricing Range</Label>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Min"
                        type="number"
                        className="pl-9"
                        value={pricingMin}
                        onChange={(e) => setPricingMin(e.target.value)}
                      />
                    </div>
                    <span className="text-muted-foreground">to</span>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Max"
                        type="number"
                        className="pl-9"
                        value={pricingMax}
                        onChange={(e) => setPricingMax(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionType">Commission Type</Label>
                  <Select value={commissionType} onValueChange={setCommissionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMISSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commissionRate">
                    Commission Rate {commissionType === 'percentage' ? '(%)' : '($)'}
                  </Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    placeholder={commissionType === 'percentage' ? 'e.g., 15' : 'e.g., 100'}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payoutSchedule">Payout Schedule</Label>
                  <Select value={payoutSchedule} onValueChange={setPayoutSchedule}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_SCHEDULES.map((schedule) => (
                        <SelectItem key={schedule.value} value={schedule.value}>
                          {schedule.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricingNotes">Pricing Notes / Special Terms</Label>
                <Textarea
                  id="pricingNotes"
                  placeholder="Any special pricing rules, discounts, or terms..."
                  rows={2}
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section D: Primary Contact */}
        <AccordionItem value="contact" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <User className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Primary Contact</p>
                <p className="text-sm text-muted-foreground">Main point of contact</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactName"
                      placeholder="John Smith"
                      className="pl-9"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactTitle">Title / Role</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactTitle"
                      placeholder="Owner, Manager, etc."
                      className="pl-9"
                      value={contactTitle}
                      onChange={(e) => setContactTitle(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactPhone"
                      placeholder="(555) 123-4567"
                      className="pl-9"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="john@partner.com"
                      className="pl-9"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                <Select value={preferredContactMethod} onValueChange={setPreferredContactMethod}>
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section E: Contract & Status */}
        <AccordionItem value="contract" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-orange-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Contract & Status</p>
                <p className="text-sm text-muted-foreground">Agreement details and internal flags</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractStatus">Contract Status</Label>
                  <Select value={contractStatus} onValueChange={setContractStatus}>
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
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="startDate"
                      type="date"
                      className="pl-9"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewalDate">Renewal Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="renewalDate"
                      type="date"
                      className="pl-9"
                      value={renewalDate}
                      onChange={(e) => setRenewalDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <input
                  type="checkbox"
                  id="riskFlag"
                  checked={riskFlag}
                  onChange={(e) => setRiskFlag(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <Label htmlFor="riskFlag" className="cursor-pointer flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Internal Risk Flag
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Mark if there are concerns about this partner
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea
                  id="internalNotes"
                  placeholder="Any internal notes about this partner..."
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section F: Assets Upload */}
        <AccordionItem value="assets" className="border rounded-lg px-4">
          <AccordionTrigger className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Upload className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Assets Upload</p>
                <p className="text-sm text-muted-foreground">Contracts, media, and documents</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid gap-6 pt-2">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Contract Files</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        PDF, DOC, DOCX up to 10MB
                      </p>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Contract
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Media & Photos</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        JPG, PNG, MP4 up to 50MB
                      </p>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Media
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Certifications</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Licenses, certifications, permits
                      </p>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Certifications
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="font-medium">Insurance Documents</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Liability, coverage proofs
                      </p>
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Insurance
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Bottom Action Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {partnerName && categoryInfo && (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Ready to save: <strong>{partnerName}</strong> ({categoryInfo.label})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Partner'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
