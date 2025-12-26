/**
 * TopTier Add New Customer - Full intake form with validation
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { 
  ArrowLeft, Save, User, Phone, Mail, MapPin, 
  DollarSign, Calendar, Shield, StickyNote, Loader2,
  UserPlus, CheckCircle, Instagram, Twitter, Facebook, Globe, Cake
} from 'lucide-react';
import { US_STATES, TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from '@/hooks/use-toast';

// Form validation schema
const customerFormSchema = z.object({
  // Basic Info
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Enter a valid phone number').regex(/^\+?[1-9]\d{1,14}$|^\d{10}$/, 'Invalid phone format'),
  email: z.string().email('Enter a valid email address'),
  preferred_contact: z.enum(['call', 'text', 'email']),
  dob: z.string().optional(),
  
  // Location
  primary_state: z.string().min(1, 'Select a state'),
  cities: z.string().optional(),
  travel_willingness: z.enum(['local', 'multi_state', 'nationwide']),
  
  // Profile
  customer_type: z.enum(['new', 'returning', 'vip']).optional(),
  preferred_categories: z.array(z.string()).min(1, 'Select at least one category'),
  budget_range: z.string().optional(),
  event_frequency: z.enum(['one_time', 'recurring']),
  
  // Social Media
  social_instagram: z.string().optional(),
  social_tiktok: z.string().optional(),
  social_twitter: z.string().optional(),
  social_facebook: z.string().optional(),
  social_other_label: z.string().optional(),
  social_other_url: z.string().optional(),
  
  // Consent
  sms_opt_in: z.boolean(),
  email_opt_in: z.boolean(),
  consent_notes: z.string().optional(),
  
  // Internal Notes
  sales_notes: z.string().optional(),
  preferences: z.string().optional(),
  vip_flag: z.boolean().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export default function TopTierNewCustomer() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [saving, setSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<'profile' | 'booking' | 'interaction' | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      preferred_contact: 'text',
      dob: '',
      primary_state: '',
      cities: '',
      travel_willingness: 'local',
      customer_type: 'new',
      preferred_categories: [],
      budget_range: '',
      event_frequency: 'one_time',
      social_instagram: '',
      social_tiktok: '',
      social_twitter: '',
      social_facebook: '',
      social_other_label: '',
      social_other_url: '',
      sms_opt_in: false,
      email_opt_in: false,
      consent_notes: '',
      sales_notes: '',
      preferences: '',
      vip_flag: false,
    },
  });

  const onSubmit = async (data: CustomerFormValues, action: 'profile' | 'booking' | 'interaction') => {
    setSaving(true);
    setSaveAction(action);
    
    try {
      // Format phone to E.164
      let formattedPhone = data.phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
        formattedPhone = '1' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;

      if (simulationMode) {
        // Simulate save delay
        await new Promise(r => setTimeout(r, 1500));
        
        toast({
          title: '✅ Customer Created (Simulated)',
          description: `${data.full_name} has been added to the database`,
        });

        // Generate fake ID for navigation
        const fakeId = `cust_sim_${Date.now()}`;
        
        switch (action) {
          case 'profile':
            navigate(`/crm/toptier-experience/customers/${fakeId}`);
            break;
          case 'booking':
            navigate(`/crm/toptier-experience/deals/new?customerId=${fakeId}`);
            break;
          case 'interaction':
            navigate(`/crm/toptier-experience/customers/${fakeId}?tab=interactions`);
            break;
        }
      } else {
        // Real save to database would happen here
        toast({
          title: '✅ Customer Created',
          description: `${data.full_name} has been added successfully`,
        });
        navigate('/crm/toptier-experience/customers');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create customer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setSaveAction(null);
    }
  };

  const budgetRanges = [
    '$1,000 - $5,000',
    '$5,000 - $15,000',
    '$15,000 - $50,000',
    '$50,000 - $100,000',
    '$100,000+',
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Add New Customer</h1>
              {simulationMode && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Complete customer intake form</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          {/* Section 1: Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Contact details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferred_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Contact Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="call">📞 Call</SelectItem>
                          <SelectItem value="text">💬 Text</SelectItem>
                          <SelectItem value="email">✉️ Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="+1 (555) 123-4567" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="john@email.com" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Cake className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="date" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormDescription>Used for birthday offers and age verification</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 2: Social Media */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Social Media
              </CardTitle>
              <CardDescription>Social profiles for marketing and engagement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="social_instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                          <Input placeholder="@username or URL" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="social_tiktok"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TikTok</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                          </svg>
                          <Input placeholder="@username or URL" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="social_twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>X / Twitter</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500" />
                          <Input placeholder="@username or URL" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="social_facebook"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facebook</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                          <Input placeholder="Profile URL" className="pl-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="social_other_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Social (Label)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., YouTube, LinkedIn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="social_other_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Social (URL)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
              <CardDescription>Service area and travel preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primary_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary State *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map(state => (
                            <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City(s)</FormLabel>
                      <FormControl>
                        <Input placeholder="Miami, Fort Lauderdale" {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated list of cities</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="travel_willingness"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel Willingness</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select willingness" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="local">Local only (within state)</SelectItem>
                        <SelectItem value="multi_state">Multi-state (regional)</SelectItem>
                        <SelectItem value="nationwide">Nationwide</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 3: Customer Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Customer Profile
              </CardTitle>
              <CardDescription>Interests and budget preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="preferred_categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Categories *</FormLabel>
                    <FormDescription>Select all service categories of interest</FormDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TOPTIER_PARTNER_CATEGORIES.map(cat => {
                        const isSelected = field.value.includes(cat.value);
                        return (
                          <Badge
                            key={cat.value}
                            variant={isSelected ? 'default' : 'outline'}
                            className={`cursor-pointer transition-all ${isSelected ? '' : 'hover:bg-muted'}`}
                            onClick={() => {
                              if (isSelected) {
                                field.onChange(field.value.filter((v: string) => v !== cat.value));
                              } else {
                                field.onChange([...field.value, cat.value]);
                              }
                            }}
                          >
                            {cat.icon} {cat.label}
                          </Badge>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="budget_range"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Range</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgetRanges.map(range => (
                            <SelectItem key={range} value={range}>{range}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="event_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="one_time">One-time event</SelectItem>
                          <SelectItem value="recurring">Recurring events</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Consent & Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Consent & Compliance
              </CardTitle>
              <CardDescription>Communication permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sms_opt_in"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>SMS Opt-In</FormLabel>
                        <FormDescription>
                          Customer consents to receive text messages
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email_opt_in"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Email Opt-In</FormLabel>
                        <FormDescription>
                          Customer consents to receive emails
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="consent_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consent Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any consent-related notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 5: Internal Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Internal Notes
              </CardTitle>
              <CardDescription>Team-only information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sales_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Lead source, acquisition notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Preferences</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Special requests, preferences, behavior notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vip_flag"
                render={({ field }) => (
                  <FormItem className="flex items-start space-x-3 space-y-0 p-4 border rounded-lg bg-purple-500/5 border-purple-500/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-purple-600">VIP Customer Flag</FormLabel>
                      <FormDescription>
                        Mark as VIP for priority service
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Section 6: Save Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Save Customer
              </CardTitle>
              <CardDescription>Choose your next action after saving</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Button
                  type="button"
                  onClick={form.handleSubmit((data) => onSubmit(data, 'profile'))}
                  disabled={saving}
                  className="h-auto py-4 flex-col gap-2"
                >
                  {saving && saveAction === 'profile' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  <span>Save & View Profile</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit((data) => onSubmit(data, 'booking'))}
                  disabled={saving}
                  className="h-auto py-4 flex-col gap-2"
                >
                  {saving && saveAction === 'booking' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Calendar className="h-5 w-5" />
                  )}
                  <span>Save & Create Booking</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit((data) => onSubmit(data, 'interaction'))}
                  disabled={saving}
                  className="h-auto py-4 flex-col gap-2"
                >
                  {saving && saveAction === 'interaction' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                  <span>Save & Add Interaction</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
