import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hourglass, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { getRoleRedirectPath, type OSRole } from '@/config/osNavigation';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();
  const { role: rbacRole, loading: rbacLoading } = useUserRole();

  // If the user actually has a role (either from user_profiles or user_roles),
  // don't leave them stuck here — send them to their portal.
  useEffect(() => {
    if (!user) return;
    if (profileLoading || rbacLoading) return;

    const resolvedRole =
      (profileData?.profile?.primary_role as OSRole | undefined) ??
      (rbacRole as OSRole | null | undefined) ??
      null;

    if (resolvedRole) {
      navigate(getRoleRedirectPath(resolvedRole), { replace: true });
    }
  }, [user, profileData, profileLoading, rbacRole, rbacLoading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Hourglass className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Awaiting approval</CardTitle>
          <CardDescription>
            Your account {user?.email ? `(${user.email})` : ''} was created successfully.
            An administrator must assign you a role before you can access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
