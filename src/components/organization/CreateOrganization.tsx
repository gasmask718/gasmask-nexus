import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useOrganizationManagement } from '@/services/organization/useOrganization';
import { Building2, Store, Truck, ArrowRight } from 'lucide-react';

interface CreateOrganizationProps {
  onSuccess?: (orgId: string) => void;
}

export function CreateOrganization({ onSuccess }: CreateOrganizationProps) {
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<'store' | 'wholesaler'>('store');
  const [billingEmail, setBillingEmail] = useState('');

  const { createOrganization } = useOrganizationManagement(undefined);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    try {
      const org = await createOrganization.mutateAsync({
        name: name.trim(),
        org_type: orgType,
        billing_email: billingEmail || undefined,
      });
      onSuccess?.(org.id);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>
          Set up your business to start managing your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Organization Type</Label>
          <RadioGroup 
            value={orgType} 
            onValueChange={(v) => setOrgType(v as 'store' | 'wholesaler')}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="store"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                orgType === 'store' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
              }`}
            >
              <RadioGroupItem value="store" id="store" className="sr-only" />
              <Store className="h-6 w-6" />
              <span className="font-medium">Store</span>
              <span className="text-xs text-muted-foreground text-center">Retail or B2B buyer</span>
            </Label>
            <Label
              htmlFor="wholesaler"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                orgType === 'wholesaler' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
              }`}
            >
              <RadioGroupItem value="wholesaler" id="wholesaler" className="sr-only" />
              <Truck className="h-6 w-6" />
              <span className="font-medium">Wholesaler</span>
              <span className="text-xs text-muted-foreground text-center">Sell to stores</span>
            </Label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Organization Name</Label>
          <Input
            placeholder="My Business"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Billing Email (optional)</Label>
          <Input
            type="email"
            placeholder="billing@mybusiness.com"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
          />
        </div>

        <Button 
          className="w-full" 
          onClick={handleCreate}
          disabled={createOrganization.isPending || !name.trim()}
        >
          {createOrganization.isPending ? 'Creating...' : 'Create Organization'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default CreateOrganization;
