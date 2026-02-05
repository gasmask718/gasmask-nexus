import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  User, 
  Truck, 
  FileText, 
  Shield, 
  Star,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { PagePurpose, AccountUpdateGuide } from '@/components/portal/guidance';

interface DriverProfile {
  id: string;
  user_id: string;
  status: 'pending' | 'active' | 'suspended';
  region: string;
  vehicle_type: string;
  license_number: string;
  insurance_verified: boolean;
  pay_type: string;
}

interface ProfilePageProps {
  portalType: 'driver' | 'biker';
}

export function ProfilePage({ portalType }: ProfilePageProps) {
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  const { data: profileData, refetch } = useCurrentUserProfile();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    vehicle_type: '',
    license_number: '',
  });

  useEffect(() => {
    async function fetchDriverProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch driver-specific profile
        const { data: driverData } = await supabase
          .from('driver_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (driverData) {
          setDriverProfile(driverData as DriverProfile);
          setEditForm(prev => ({
            ...prev,
            vehicle_type: driverData.vehicle_type || '',
            license_number: driverData.license_number || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching driver profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDriverProfile();
  }, []);

  useEffect(() => {
    if (profileData?.profile) {
      setEditForm(prev => ({
        ...prev,
        full_name: profileData.profile.full_name || '',
        phone: profileData.profile.phone || '',
      }));
    }
  }, [profileData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update driver profile
      if (driverProfile) {
        const { error: driverError } = await supabase
          .from('driver_profiles')
          .update({
            vehicle_type: editForm.vehicle_type,
            license_number: editForm.license_number,
          })
          .eq('user_id', user.id);

        if (driverError) throw driverError;
      }

      toast({ title: 'Profile updated' });
      setEditing(false);
      refetch();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Failed to save profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const profile = profileData?.profile;

  // Page purpose configuration
  const profilePurpose = {
    driver: {
      title: t('page.profile.purpose'),
      description: t('page.profile.purpose'),
      actions: ['Update your personal details', 'Check account status', 'Review vehicle info'],
      warnings: ['Some changes require admin approval'],
    },
    biker: {
      title: t('page.profile.purpose'),
      description: t('page.profile.purpose'),
      actions: ['Update your personal details', 'Check account status'],
      warnings: ['Some changes require admin approval'],
    },
    default: {
      title: t('page.profile.purpose'),
      description: t('page.profile.purpose'),
      actions: ['Update your personal details'],
      warnings: [],
    },
  };

  return (
    <div className={cn('space-y-4', isRTL && 'text-right')}>
      {/* Page Purpose */}
      <PagePurpose pageKey="profile" config={profilePurpose} variant="compact" />
      
      {/* Account Update Guide */}
      <AccountUpdateGuide />
      
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <div>
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">Your account and vehicle information</p>
        </div>
        <Button 
          variant={editing ? 'default' : 'outline'} 
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className="gap-2"
        >
          {editing ? (
            <>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </>
          ) : (
            <>
              <Edit2 className="h-4 w-4" />
              Edit Profile
            </>
          )}
        </Button>
      </div>

      {/* Status Card */}
      <Card className={
        driverProfile?.status === 'active' 
          ? 'border-green-500/30 bg-green-500/5' 
          : driverProfile?.status === 'suspended'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                driverProfile?.status === 'active' 
                  ? 'bg-green-500/20 text-green-500' 
                  : driverProfile?.status === 'suspended'
                  ? 'bg-destructive/20 text-destructive'
                  : 'bg-amber-500/20 text-amber-500'
              }`}>
                {driverProfile?.status === 'active' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="font-medium">Account Status</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {driverProfile?.status || 'pending'}
                </p>
              </div>
            </div>
            <Badge variant={driverProfile?.status === 'active' ? 'default' : 'secondary'} className="uppercase">
              {driverProfile?.status || 'pending'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              {editing ? (
                <Input 
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded-md">{profile?.full_name || 'Not set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm p-2 bg-muted/50 rounded-md flex items-center gap-2">
                <Mail className="h-3 w-3" />
                {(profile as any)?.email || 'Not set'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              {editing ? (
                <Input 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded-md flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {profile?.phone || 'Not set'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <p className="text-sm p-2 bg-muted/50 rounded-md flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {driverProfile?.region || 'Not assigned'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              {editing ? (
                <Input 
                  value={editForm.vehicle_type}
                  onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                  placeholder="e.g., Van, Sedan, SUV"
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded-md">{driverProfile?.vehicle_type || 'Not set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>License Number</Label>
              {editing ? (
                <Input 
                  value={editForm.license_number}
                  onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })}
                  placeholder="Driver's license number"
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded-md">{driverProfile?.license_number || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance & Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  driverProfile?.insurance_verified 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-amber-500/20 text-amber-500'
                }`}>
                  {driverProfile?.insurance_verified ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Insurance Verification</p>
                  <p className="text-xs text-muted-foreground">
                    {driverProfile?.insurance_verified ? 'Verified' : 'Pending verification'}
                  </p>
                </div>
              </div>
              <Badge variant={driverProfile?.insurance_verified ? 'default' : 'secondary'}>
                {driverProfile?.insurance_verified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Driver's License</p>
                  <p className="text-xs text-muted-foreground">License verification</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Upload</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5" />
            Performance Summary
          </CardTitle>
          <CardDescription>Your delivery performance this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-green-600">--</p>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">On-Time %</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">Stores Visited</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pay Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pay Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">Pay Type</p>
              <p className="text-sm text-muted-foreground capitalize">
                {driverProfile?.pay_type?.replace('_', ' ') || 'Per Route'}
              </p>
            </div>
            <Badge variant="outline" className="uppercase">
              {driverProfile?.pay_type?.replace('_', ' ') || 'per route'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
