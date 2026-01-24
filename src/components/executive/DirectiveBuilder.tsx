import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target, X, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DirectiveBuilderProps {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
}

const DIRECTIVE_TYPES = [
  { value: 'growth', label: 'Growth', description: 'Expand market presence' },
  { value: 'launch', label: 'Product Launch', description: 'Introduce new products' },
  { value: 'acquisition', label: 'Acquisition', description: 'Recruit vendors/partners' },
  { value: 'recovery', label: 'Recovery', description: 'Re-engage dormant accounts' },
  { value: 'optimization', label: 'Optimization', description: 'Improve existing performance' },
  { value: 'test', label: 'Test', description: 'Experimental campaign' },
  { value: 'hold', label: 'Hold', description: 'Maintain current state' },
];

const SCOPE_OPTIONS = [
  { value: 'campaign', label: 'Single Campaign' },
  { value: 'business', label: 'Business-Wide' },
  { value: 'brand', label: 'Brand-Wide' },
  { value: 'global', label: 'Global (All Brands)' },
];

export function DirectiveBuilder({ businessId, onClose, onCreated }: DirectiveBuilderProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    directive_name: '',
    directive_type: '',
    scope: 'campaign',
    strategic_intent: '',
    expires_in_days: 30,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.directive_name || !formData.directive_type || !formData.strategic_intent) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + formData.expires_in_days);

      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: {
          action: 'create',
          business_id: businessId,
          directive_data: {
            directive_name: formData.directive_name,
            directive_type: formData.directive_type,
            scope: formData.scope,
            strategic_intent: formData.strategic_intent,
            expires_at: expiresAt.toISOString(),
          }
        }
      });

      if (error) throw error;
      if (data.success) {
        toast({
          title: 'Directive Created',
          description: `"${formData.directive_name}" is ready for activation`
        });
        onCreated();
      }
    } catch (error) {
      console.error('Error creating directive:', error);
      toast({
        title: 'Error',
        description: 'Failed to create directive',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>New Executive Directive</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Define strategic intent for AI execution. AI operates within this directive — it cannot redefine strategy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Directive Name *</Label>
              <Input
                id="name"
                placeholder="Q1 Store Expansion"
                value={formData.directive_name}
                onChange={(e) => setFormData({ ...formData, directive_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.directive_type}
                onValueChange={(value) => setFormData({ ...formData, directive_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIVE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">— {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => setFormData({ ...formData, scope: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Expires In (days)</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={formData.expires_in_days}
                  onChange={(e) => setFormData({ ...formData, expires_in_days: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="intent">Strategic Intent *</Label>
            <Textarea
              id="intent"
              placeholder="Describe what this directive aims to achieve. Be specific about goals, constraints, and success criteria."
              rows={3}
              value={formData.strategic_intent}
              onChange={(e) => setFormData({ ...formData, strategic_intent: e.target.value })}
            />
          </div>

          {/* Powers reminder */}
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">Executive AI Constraint</p>
                <p className="text-muted-foreground">
                  AI will execute within this directive but cannot launch campaigns without approval, 
                  modify compliance baselines, or bypass Sentinel containment.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Directive'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default DirectiveBuilder;
