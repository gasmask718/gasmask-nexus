import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleRedirectPath, getRoleDisplayName, PrimaryRole } from '@/services/roleService';
import PortalLayout from '@/components/portal/PortalLayout';

export default function PortalHome() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCurrentUserProfile();

  useEffect(() => {
    if (!isLoading && data?.profile) {
      const redirectPath = getRoleRedirectPath(data.profile.primary_role);
      if (redirectPath !== '/portal/home') {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [data, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <PortalLayout title="Welcome">
        <div className="max-w-md mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle>Profile Not Found</CardTitle>
              <CardDescription>
                We couldn't detect your role. Please complete your profile setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={() => navigate('/portal/onboarding')}>
                Complete Setup
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/portal/register')}>
                Register as New User
              </Button>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  // Show profile info while redirecting
  return (
    <PortalLayout title="Portal Home">
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome, {data.profile.full_name || 'User'}</CardTitle>
            <CardDescription>
              Role: {getRoleDisplayName(data.profile.primary_role)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate(getRoleRedirectPath(data.profile.primary_role))}
            >
              Go to My Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
