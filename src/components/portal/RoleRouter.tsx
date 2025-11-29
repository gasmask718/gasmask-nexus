import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleRedirectPath } from '@/services/roleService';
import { Loader2 } from 'lucide-react';

export default function RoleRouter() {
  const navigate = useNavigate();
  const { data, isLoading } = useCurrentUserProfile();

  useEffect(() => {
    if (isLoading) return;

    if (!data?.profile) {
      // No profile exists, send to onboarding
      navigate('/portal/onboarding', { replace: true });
      return;
    }

    // Redirect based on primary role
    const redirectPath = getRoleRedirectPath(data.profile.primary_role);
    navigate(redirectPath, { replace: true });
  }, [data, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading your portal...</p>
      </div>
    </div>
  );
}
