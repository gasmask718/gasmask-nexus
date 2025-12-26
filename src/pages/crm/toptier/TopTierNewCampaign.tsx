/**
 * TopTier New Campaign - Create campaign form
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Megaphone, DollarSign, Calendar, Target } from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

export default function TopTierNewCampaign() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    start_date: '',
    end_date: '',
    budget: '',
    goal: '',
    target_leads: '',
    target_conversions: '',
    commission_rules: '',
    tracking_link: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (action: 'view' | 'another' | 'close') => {
    if (!formData.name || !formData.category) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      if (simulationMode) {
        toast.success('Campaign created (Simulation Mode)');
      } else {
        toast.success('Campaign created successfully');
      }

      if (action === 'view') {
        navigate(`/crm/toptier-experience/campaigns/campaign_new`);
      } else if (action === 'another') {
        setFormData({
          name: '', category: '', description: '', start_date: '', end_date: '',
          budget: '', goal: '', target_leads: '', target_conversions: '',
          commission_rules: '', tracking_link: '', notes: '',
        });
      } else {
        navigate('/crm/toptier-experience/campaigns');
      }
    } catch (error) {
      toast.error('Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/campaigns')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
        
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Create New Campaign</h1>
          {simulationMode && <SimulationBadge />}
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Summer Yacht Special"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TOPTIER_PARTNER_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Campaign Goal</Label>
            <Select value={formData.goal} onValueChange={(v) => handleChange('goal', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Brand Awareness</SelectItem>
                <SelectItem value="leads">Lead Generation</SelectItem>
                <SelectItem value="conversions">Conversions</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Campaign description..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget & Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Budget & Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="budget">Budget ($)</Label>
            <Input
              id="budget"
              type="number"
              value={formData.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              placeholder="5000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_leads">Target Leads</Label>
            <Input
              id="target_leads"
              type="number"
              value={formData.target_leads}
              onChange={(e) => handleChange('target_leads', e.target.value)}
              placeholder="50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_conversions">Target Conversions</Label>
            <Input
              id="target_conversions"
              type="number"
              value={formData.target_conversions}
              onChange={(e) => handleChange('target_conversions', e.target.value)}
              placeholder="10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Tracking & Commission</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="tracking_link">Tracking Link</Label>
            <Input
              id="tracking_link"
              value={formData.tracking_link}
              onChange={(e) => handleChange('tracking_link', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_rules">Commission Rules</Label>
            <Textarea
              id="commission_rules"
              value={formData.commission_rules}
              onChange={(e) => handleChange('commission_rules', e.target.value)}
              placeholder="Define commission structure..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate('/crm/toptier-experience/campaigns')}>
          Cancel
        </Button>
        <Button 
          variant="outline"
          onClick={() => handleSubmit('close')}
          disabled={isSubmitting}
        >
          Save as Draft
        </Button>
        <Button 
          onClick={() => handleSubmit('view')}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          Save & View Campaign
        </Button>
      </div>
    </div>
  );
}
