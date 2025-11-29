import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Truck, Bike, Users, Package, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { createUserProfile, createRoleProfile, getRoleRedirectPath, PrimaryRole, PreferredLanguage } from '@/services/roleService';
import { toast } from 'sonner';

const roleOptions = [
  { type: 'store_owner' as PrimaryRole, icon: Store, title: 'Store Owner', description: 'Buy wholesale products' },
  { type: 'wholesaler' as PrimaryRole, icon: Package, title: 'Wholesaler', description: 'Supply products' },
  { type: 'ambassador' as PrimaryRole, icon: Users, title: 'Ambassador', description: 'Refer and earn' },
  { type: 'driver' as PrimaryRole, icon: Truck, title: 'Driver', description: 'Deliver products' },
  { type: 'biker' as PrimaryRole, icon: Bike, title: 'Store Checker', description: 'Check inventory' },
];

export default function PortalOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [selectedRole, setSelectedRole] = useState<PrimaryRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [roleData, setRoleData] = useState<Record<string, any>>({});

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleComplete = async () => {
    if (!selectedRole || !fullName) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await createUserProfile(user.id, {
        full_name: fullName,
        phone,
        primary_role: selectedRole,
        preferred_language: language
      });

      if (Object.keys(roleData).length > 0) {
        await createRoleProfile(user.id, selectedRole, roleData);
      }

      toast.success('Profile complete! Redirecting...');
      navigate(getRoleRedirectPath(selectedRole));
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const updateRoleData = (key: string, value: any) => {
    setRoleData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center mt-2">Step {step} of {totalSteps}</p>
        </div>

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>What brings you here?</CardTitle>
              <CardDescription>Select your primary role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {roleOptions.map(({ type, icon: Icon, title, description }) => (
                <div
                  key={type}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedRole === type ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedRole(type)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedRole === type ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  {selectedRole === type && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              ))}
              <Button 
                className="w-full mt-4" 
                onClick={() => setStep(2)}
                disabled={!selectedRole}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Basic Info */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Tell us about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as PreferredLanguage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={() => setStep(3)}
                disabled={!fullName}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Role-specific details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <CardTitle>Additional Details</CardTitle>
              <CardDescription>Optional information for your role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRole === 'store_owner' && (
                <>
                  <div className="space-y-2">
                    <Label>Store Name</Label>
                    <Input
                      placeholder="My Smoke Shop"
                      value={roleData.store_name || ''}
                      onChange={(e) => updateRoleData('store_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="Miami"
                      value={roleData.city || ''}
                      onChange={(e) => updateRoleData('city', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedRole === 'wholesaler' && (
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    placeholder="ABC Distribution LLC"
                    value={roleData.company_name || ''}
                    onChange={(e) => updateRoleData('company_name', e.target.value)}
                  />
                </div>
              )}

              {selectedRole === 'ambassador' && (
                <>
                  <div className="space-y-2">
                    <Label>TikTok Handle</Label>
                    <Input
                      placeholder="@yourtiktok"
                      value={roleData.tiktok_handle || ''}
                      onChange={(e) => updateRoleData('tiktok_handle', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram Handle</Label>
                    <Input
                      placeholder="@yourinstagram"
                      value={roleData.instagram_handle || ''}
                      onChange={(e) => updateRoleData('instagram_handle', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedRole === 'driver' && (
                <>
                  <div className="space-y-2">
                    <Label>Vehicle Type</Label>
                    <Select 
                      value={roleData.vehicle_type || ''} 
                      onValueChange={(v) => updateRoleData('vehicle_type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedan">Sedan</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Input
                      placeholder="South Florida"
                      value={roleData.region || ''}
                      onChange={(e) => updateRoleData('region', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedRole === 'biker' && (
                <>
                  <div className="space-y-2">
                    <Label>Transport Type</Label>
                    <Select 
                      value={roleData.primary_transport || ''} 
                      onValueChange={(v) => updateRoleData('primary_transport', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transport" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bike">Bicycle</SelectItem>
                        <SelectItem value="ebike">E-Bike</SelectItem>
                        <SelectItem value="scooter">Scooter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zone / Neighborhood</Label>
                    <Input
                      placeholder="Downtown"
                      value={roleData.zone || ''}
                      onChange={(e) => updateRoleData('zone', e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button className="w-full" onClick={handleComplete} disabled={loading}>
                {loading ? 'Saving...' : 'Complete Setup'}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
