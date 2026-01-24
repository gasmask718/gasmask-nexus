import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Rocket, Target, Shield, FileText, Users, AlertTriangle, 
  CheckCircle2, XCircle, Loader2, ArrowRight
} from 'lucide-react';
import { useCreateCampaign, useProductPlaybooks, useVendorPlaybooks, OutboundCampaign } from '@/hooks/useOutboundCampaigns';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

interface CampaignBuilderProps {
  onSuccess?: () => void;
}

export function CampaignBuilder({ onSuccess }: CampaignBuilderProps) {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  
  const createCampaign = useCreateCampaign();
  const { data: productPlaybooks } = useProductPlaybooks(businessId || null);
  const { data: vendorPlaybooks } = useVendorPlaybooks(businessId || null);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaign_type: '' as OutboundCampaign['campaign_type'] | '',
    audience_type: 'existing_customers',
    max_calls_per_day: 100,
    max_calls_per_contact: 3,
    cooldown_period_days: 7,
    b2b_only: true,
    mandatory_ai_disclosure: 'This is an automated call on behalf of our company. You are speaking with an AI assistant.',
    product_playbook_id: '',
    vendor_playbook_id: '',
    prohibited_claims: [] as string[],
    required_disclaimers: [] as string[],
  });

  const handleSubmit = async () => {
    if (!businessId) {
      toast.error('Please select a business first');
      return;
    }

    try {
      await createCampaign.mutateAsync({
        business_id: businessId,
        data: formData,
      });
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const campaignTypes = [
    { value: 'product_launch', label: 'Product Launch', icon: Rocket, description: 'Introduce new products to stores' },
    { value: 'vendor_recruitment', label: 'Vendor Recruitment', icon: Users, description: 'Recruit vendors for marketplace' },
    { value: 'store_reactivation', label: 'Store Reactivation', icon: Target, description: 'Re-engage dormant stores' },
    { value: 'marketplace_growth', label: 'Marketplace Growth', icon: Target, description: 'Expand marketplace presence' },
  ];

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please select a business to create a campaign</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary text-primary-foreground' :
              step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />}
          </div>
        ))}
      </div>

      {/* Step 1: Campaign Type */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Campaign Type</CardTitle>
            <CardDescription>Choose the type of outbound campaign you want to create</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setFormData({ ...formData, campaign_type: type.value as OutboundCampaign['campaign_type'] });
                    setStep(2);
                  }}
                  className={`p-6 border rounded-lg text-left hover:border-primary transition-colors ${
                    formData.campaign_type === type.value ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <type.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold">{type.label}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Campaign Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Configure your campaign settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 Product Launch - New SKUs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the campaign goals and target audience..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audience Type</Label>
                <Select
                  value={formData.audience_type}
                  onValueChange={(v) => setFormData({ ...formData, audience_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing_customers">Existing Customers</SelectItem>
                    <SelectItem value="b2b_prospects">B2B Prospects</SelectItem>
                    <SelectItem value="lapsed_customers">Lapsed Customers</SelectItem>
                    <SelectItem value="new_leads">New Leads</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Calls Per Day</Label>
                <Input
                  type="number"
                  value={formData.max_calls_per_day}
                  onChange={(e) => setFormData({ ...formData, max_calls_per_day: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button 
                onClick={() => setStep(3)} 
                disabled={!formData.name}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Playbook Selection */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Attach Playbook</CardTitle>
            <CardDescription>Select an approved playbook for AI to follow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.campaign_type === 'vendor_recruitment' ? (
              <div className="space-y-4">
                <Label>Vendor Recruitment Playbook</Label>
                {vendorPlaybooks?.length ? (
                  <div className="grid gap-3">
                    {vendorPlaybooks.filter(p => p.is_active).map((playbook) => (
                      <button
                        key={playbook.id}
                        onClick={() => setFormData({ ...formData, vendor_playbook_id: playbook.id })}
                        className={`p-4 border rounded-lg text-left ${
                          formData.vendor_playbook_id === playbook.id ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{playbook.service_category}</span>
                          <Badge variant="outline" className="text-green-600">Approved</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{playbook.outreach_goal}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No approved vendor playbooks found</p>
                    <Button variant="link" className="mt-2">Create Playbook</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Product Launch Playbook</Label>
                {productPlaybooks?.length ? (
                  <div className="grid gap-3">
                    {productPlaybooks.filter(p => p.is_active).map((playbook) => (
                      <button
                        key={playbook.id}
                        onClick={() => setFormData({ ...formData, product_playbook_id: playbook.id })}
                        className={`p-4 border rounded-lg text-left ${
                          formData.product_playbook_id === playbook.id ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{playbook.product_name}</span>
                          <Badge variant="outline" className="text-green-600">Approved</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {playbook.product_description}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No approved product playbooks found</p>
                    <Button variant="link" className="mt-2">Create Playbook</Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Compliance & Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              Compliance & Safety
            </CardTitle>
            <CardDescription>Review compliance settings before creating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">B2B Only (No Consumer Calls)</span>
                <Switch checked={formData.b2b_only} disabled />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Requires Sentinel Approval</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Kill Switch Enabled</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-Halt on Threshold Breach</span>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>AI Disclosure Script (Mandatory)</Label>
              <Textarea
                value={formData.mandatory_ai_disclosure}
                onChange={(e) => setFormData({ ...formData, mandatory_ai_disclosure: e.target.value })}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">AI must speak this at the start of every call</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Requires Admin Approval</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This campaign will be created in Draft status. An admin must approve it before calls can begin.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button 
                onClick={handleSubmit}
                disabled={createCampaign.isPending}
                className="gap-2"
              >
                {createCampaign.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Create Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
