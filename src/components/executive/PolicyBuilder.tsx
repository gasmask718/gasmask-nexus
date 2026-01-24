import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Shield } from 'lucide-react';
import { useExecutiveAI } from '@/hooks/useExecutiveAI';

interface PolicyBuilderProps {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
}

const POLICY_SCOPES = [
  { value: 'outbound_sales', label: 'Outbound Sales' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'vendor_recruitment', label: 'Vendor Recruitment' },
  { value: 'marketplace_growth', label: 'Marketplace Growth' },
  { value: 'store_reactivation', label: 'Store Reactivation' },
  { value: 'partnerships', label: 'Partnerships' },
];

const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const SUGGESTED_ACTIONS = [
  'call_lead', 'send_sms', 'send_email', 'schedule_callback',
  'capture_interest', 'log_objection', 'route_to_human',
  'book_demo', 'send_brochure', 'update_crm'
];

const FORBIDDEN_ACTIONS = [
  'negotiate_contract', 'offer_discount', 'make_commitment',
  'share_confidential', 'bypass_consent', 'impersonate_human'
];

export function PolicyBuilder({ businessId, onClose, onCreated }: PolicyBuilderProps) {
  const { createPolicy, isLoading } = useExecutiveAI(businessId);

  const [formData, setFormData] = useState({
    policy_name: '',
    policy_scope: '',
    description: '',
    risk_classification: 'medium',
    allowed_actions: [] as string[],
    forbidden_actions: ['negotiate_contract', 'offer_discount', 'impersonate_human'],
    approval_required_for: ['make_commitment', 'route_to_human'],
    max_contact_rate: 100,
    max_contacts_per_day: 500,
  });

  const [newAction, setNewAction] = useState('');

  const addAllowedAction = (action: string) => {
    if (action && !formData.allowed_actions.includes(action)) {
      setFormData(prev => ({
        ...prev,
        allowed_actions: [...prev.allowed_actions, action]
      }));
    }
    setNewAction('');
  };

  const removeAllowedAction = (action: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_actions: prev.allowed_actions.filter(a => a !== action)
    }));
  };

  const toggleForbidden = (action: string) => {
    setFormData(prev => ({
      ...prev,
      forbidden_actions: prev.forbidden_actions.includes(action)
        ? prev.forbidden_actions.filter(a => a !== action)
        : [...prev.forbidden_actions, action]
    }));
  };

  const handleSubmit = async () => {
    if (!formData.policy_name || !formData.policy_scope) return;

    await createPolicy({
      policy_name: formData.policy_name,
      policy_scope: formData.policy_scope,
      description: formData.description,
      risk_classification: formData.risk_classification,
      allowed_actions: formData.allowed_actions,
      forbidden_actions: formData.forbidden_actions,
      approval_required_for: formData.approval_required_for,
      max_contact_rate: formData.max_contact_rate,
      max_contacts_per_day: formData.max_contacts_per_day,
      cooldown_rules: {
        min_hours_between_contacts: 24,
        max_attempts_per_contact: 3
      }
    });

    onCreated();
  };

  return (
    <Card className="border-primary">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Create Executive Policy
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Policy Name *</Label>
            <Input
              placeholder="e.g., Product Launch - Q1 2026"
              value={formData.policy_name}
              onChange={e => setFormData(prev => ({ ...prev, policy_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Scope *</Label>
            <Select 
              value={formData.policy_scope}
              onValueChange={value => setFormData(prev => ({ ...prev, policy_scope: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_SCOPES.map(scope => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            placeholder="Describe the policy objectives and constraints..."
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>

        {/* Risk & Rate Limits */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Risk Classification</Label>
            <Select 
              value={formData.risk_classification}
              onValueChange={value => setFormData(prev => ({ ...prev, risk_classification: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map(level => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${level.color}`} />
                      {level.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Contacts/Hour</Label>
            <Input
              type="number"
              value={formData.max_contact_rate}
              onChange={e => setFormData(prev => ({ ...prev, max_contact_rate: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Contacts/Day</Label>
            <Input
              type="number"
              value={formData.max_contacts_per_day}
              onChange={e => setFormData(prev => ({ ...prev, max_contacts_per_day: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </div>

        {/* Allowed Actions */}
        <div className="space-y-2">
          <Label>Allowed Actions</Label>
          <div className="flex gap-2 mb-2">
            <Select value={newAction} onValueChange={addAllowedAction}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Add allowed action" />
              </SelectTrigger>
              <SelectContent>
                {SUGGESTED_ACTIONS.filter(a => !formData.allowed_actions.includes(a)).map(action => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.allowed_actions.map(action => (
              <Badge key={action} variant="secondary" className="gap-1">
                {action.replace(/_/g, ' ')}
                <button onClick={() => removeAllowedAction(action)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Forbidden Actions */}
        <div className="space-y-2">
          <Label>Forbidden Actions (AI is blocked)</Label>
          <div className="flex flex-wrap gap-2">
            {FORBIDDEN_ACTIONS.map(action => (
              <Badge 
                key={action}
                variant={formData.forbidden_actions.includes(action) ? "destructive" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleForbidden(action)}
              >
                {action.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !formData.policy_name || !formData.policy_scope}
          >
            Create Draft Policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PolicyBuilder;
