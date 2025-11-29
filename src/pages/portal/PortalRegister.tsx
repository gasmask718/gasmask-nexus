import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Truck, Bike, Users, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { createUserProfile, createRoleProfile, PrimaryRole, PreferredLanguage } from '@/services/roleService';
import { toast } from 'sonner';

type RegistrationType = 'store_owner' | 'wholesaler' | 'ambassador' | 'driver' | 'biker' | null;

const roleOptions = [
  { type: 'store_owner' as const, icon: Store, title: 'Store Owner', description: 'Buy wholesale products for your store' },
  { type: 'wholesaler' as const, icon: Package, title: 'Wholesaler', description: 'Supply products to our network' },
  { type: 'ambassador' as const, icon: Users, title: 'Ambassador', description: 'Refer stores and earn commissions' },
  { type: 'driver' as const, icon: Truck, title: 'Driver', description: 'Deliver products to stores' },
  { type: 'biker' as const, icon: Bike, title: 'Store Checker', description: 'Visit and check store inventory' },
];

export default function PortalRegister() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<RegistrationType>(null);
  const [step, setStep] = useState<'role' | 'auth' | 'details'>('role');
  const [loading, setLoading] = useState(false);
  
  // Auth fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Common fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  
  // Role-specific fields
  const [roleData, setRoleData] = useState<Record<string, any>>({});

  const handleRoleSelect = (role: RegistrationType) => {
    setSelectedRole(role);
    setStep('auth');
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (data.user) {
        setStep('details');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

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

      await createRoleProfile(user.id, selectedRole, roleData);

      toast.success('Registration complete!');
      navigate('/portal/home');
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  };

  const updateRoleData = (key: string, value: any) => {
    setRoleData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">OS</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Join OS Dynasty</h1>
          <p className="text-muted-foreground mt-2">Choose how you want to work with us</p>
        </div>

        {/* Step: Role Selection */}
        {step === 'role' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {roleOptions.map(({ type, icon: Icon, title, description }) => (
              <Card 
                key={type}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleRoleSelect(type)}
              >
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            ))}
            
            {/* Staff notice */}
            <Card className="sm:col-span-2 bg-muted/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Staff or VA? <Link to="/auth" className="text-primary hover:underline">Sign in here</Link> or contact support for access.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Auth */}
        {step === 'auth' && (
          <Card>
            <CardHeader>
              <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setStep('role')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>Enter your email and password to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Choose a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleSignUp} disabled={loading}>
                {loading ? 'Creating account...' : 'Continue'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>Tell us a bit more about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Common fields */}
              <div className="grid gap-4 sm:grid-cols-2">
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

              {/* Role-specific fields */}
              {selectedRole === 'store_owner' && (
                <>
                  <div className="space-y-2">
                    <Label>Store Name *</Label>
                    <Input
                      placeholder="My Smoke Shop"
                      value={roleData.store_name || ''}
                      onChange={(e) => updateRoleData('store_name', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        placeholder="Miami"
                        value={roleData.city || ''}
                        onChange={(e) => updateRoleData('city', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        placeholder="FL"
                        value={roleData.state || ''}
                        onChange={(e) => updateRoleData('state', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedRole === 'wholesaler' && (
                <>
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      placeholder="ABC Distribution LLC"
                      value={roleData.company_name || ''}
                      onChange={(e) => updateRoleData('company_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      placeholder="https://example.com"
                      value={roleData.website_url || ''}
                      onChange={(e) => updateRoleData('website_url', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedRole === 'ambassador' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="USA"
                      value={roleData.country || ''}
                      onChange={(e) => updateRoleData('country', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedRole === 'driver' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                      <Label>Default City</Label>
                      <Input
                        placeholder="Miami"
                        value={roleData.default_city || ''}
                        onChange={(e) => updateRoleData('default_city', e.target.value)}
                      />
                    </div>
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
                  <div className="grid gap-4 sm:grid-cols-2">
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
                          <SelectItem value="walking">Walking</SelectItem>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Default City</Label>
                    <Input
                      placeholder="Miami"
                      value={roleData.default_city || ''}
                      onChange={(e) => updateRoleData('default_city', e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button className="w-full" onClick={handleComplete} disabled={loading}>
                {loading ? 'Completing...' : 'Complete Registration'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
