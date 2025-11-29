import { useUserOrganizations } from '@/services/organization/useOrganization';
import { TeamManagement } from '@/components/organization/TeamManagement';
import { CreateOrganization } from '@/components/organization/CreateOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StoreTeam() {
  const navigate = useNavigate();
  const { data: orgs, isLoading } = useUserOrganizations();
  
  const storeOrg = orgs?.find(o => o.organization.org_type === 'store');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!storeOrg) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Set Up Your Store</h1>
          <p className="text-muted-foreground">Create your store organization to manage your team</p>
        </div>
        <CreateOrganization 
          onSuccess={(orgId) => {
            navigate('/portal/store/team');
            window.location.reload();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <TeamManagement orgId={storeOrg.organization.id} orgType="store" />
    </div>
  );
}
