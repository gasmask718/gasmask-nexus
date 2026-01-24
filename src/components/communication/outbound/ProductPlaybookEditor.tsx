import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Package, Shield, AlertTriangle, Plus, X, Loader2,
  CheckCircle2, Save
} from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ProductPlaybookEditorProps {
  playbook?: any;
  onClose: () => void;
}

export function ProductPlaybookEditor({ playbook, onClose }: ProductPlaybookEditorProps) {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    product_name: playbook?.product_name || '',
    product_description: playbook?.product_description || '',
    key_value_propositions: playbook?.key_value_propositions || [''],
    allowed_pricing_language: playbook?.allowed_pricing_language || [''],
    forbidden_promises: playbook?.forbidden_promises || [''],
    forbidden_pricing_claims: playbook?.forbidden_pricing_claims || [''],
    escalation_triggers: playbook?.escalation_triggers || [
      'competitor_mention', 'legal_question', 'price_negotiation', 'complaint', 'regulatory_concern'
    ],
    conversion_goals: playbook?.conversion_goals || [
      'interest_expressed', 'order_placed', 'demo_scheduled', 'callback_requested'
    ],
    confidence_floor: playbook?.confidence_floor || 0.80,
  });

  const addArrayItem = (field: keyof typeof formData) => {
    setFormData({
      ...formData,
      [field]: [...(formData[field] as string[]), ''],
    });
  };

  const removeArrayItem = (field: keyof typeof formData, index: number) => {
    const arr = formData[field] as string[];
    setFormData({
      ...formData,
      [field]: arr.filter((_, i) => i !== index),
    });
  };

  const updateArrayItem = (field: keyof typeof formData, index: number, value: string) => {
    const arr = [...(formData[field] as string[])];
    arr[index] = value;
    setFormData({ ...formData, [field]: arr });
  };

  const handleSubmit = async () => {
    if (!currentBusiness?.id) {
      toast.error('Please select a business');
      return;
    }

    if (!formData.product_name || !formData.product_description) {
      toast.error('Product name and description are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('playbook-manager', {
        body: {
          action: playbook ? 'update' : 'create',
          playbook_type: 'product',
          playbook_id: playbook?.id,
          business_id: currentBusiness.id,
          data: {
            ...formData,
            key_value_propositions: formData.key_value_propositions.filter(Boolean),
            allowed_pricing_language: formData.allowed_pricing_language.filter(Boolean),
            forbidden_promises: formData.forbidden_promises.filter(Boolean),
            forbidden_pricing_claims: formData.forbidden_pricing_claims.filter(Boolean),
          },
        },
      });

      if (error) throw error;

      toast.success(playbook ? 'Playbook updated' : 'Playbook created');
      queryClient.invalidateQueries({ queryKey: ['product-playbooks'] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save playbook');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {playbook ? 'Edit Product Playbook' : 'New Product Playbook'}
          </CardTitle>
          <CardDescription>
            Define approved messaging for AI to use when introducing this product
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="e.g., Premium Widget Pro"
              />
            </div>
            <div className="space-y-2">
              <Label>Confidence Floor</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[formData.confidence_floor * 100]}
                  onValueChange={([v]) => setFormData({ ...formData, confidence_floor: v / 100 })}
                  min={50}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <Badge variant="outline">{Math.round(formData.confidence_floor * 100)}%</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Product Description *</Label>
            <Textarea
              value={formData.product_description}
              onChange={(e) => setFormData({ ...formData, product_description: e.target.value })}
              placeholder="Describe the product in approved language..."
              rows={3}
            />
          </div>

          {/* Value Propositions */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Key Value Propositions (Approved)
            </Label>
            {formData.key_value_propositions.map((prop, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={prop}
                  onChange={(e) => updateArrayItem('key_value_propositions', i, e.target.value)}
                  placeholder="e.g., Increases efficiency by 40%"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem('key_value_propositions', i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addArrayItem('key_value_propositions')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Proposition
            </Button>
          </div>

          {/* Forbidden Promises */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Forbidden Promises (Never Say)
            </Label>
            {formData.forbidden_promises.map((promise, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={promise}
                  onChange={(e) => updateArrayItem('forbidden_promises', i, e.target.value)}
                  placeholder="e.g., Guaranteed results"
                  className="border-red-200"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem('forbidden_promises', i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => addArrayItem('forbidden_promises')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Forbidden Promise
            </Button>
          </div>

          {/* Escalation Triggers */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              Escalation Triggers
            </Label>
            <div className="flex flex-wrap gap-2">
              {formData.escalation_triggers.map((trigger, i) => (
                <Badge key={i} variant="outline" className="gap-1">
                  {trigger.replace('_', ' ')}
                  <button
                    onClick={() => removeArrayItem('escalation_triggers', i)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {playbook ? 'Update Playbook' : 'Create Playbook'}
            </Button>
          </div>

          {!playbook && (
            <p className="text-sm text-muted-foreground">
              Note: Playbooks require admin approval before they can be used in campaigns.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
