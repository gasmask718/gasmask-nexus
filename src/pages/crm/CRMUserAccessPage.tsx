/**
 * CRM User Access Management Page
 * Manage user invitations and CRM access from Global CRM
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users, Mail } from 'lucide-react';
import CRMLayout from './CRMLayout';
import { InviteUserModal } from '@/components/crm/InviteUserModal';
import { CRMInvitationsPanel } from '@/components/crm/CRMInvitationsPanel';
import { CRMAccessManagement } from '@/components/crm/CRMAccessManagement';

export default function CRMUserAccessPage() {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <CRMLayout title="User Access">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Access Management</h1>
            <p className="text-muted-foreground mt-1">
              Invite users and manage CRM permissions across all businesses
            </p>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="access" className="space-y-4">
          <TabsList>
            <TabsTrigger value="access" className="gap-2">
              <Users className="h-4 w-4" />
              Active Access
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-2">
              <Mail className="h-4 w-4" />
              Invitations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="access">
            <Card>
              <CardHeader>
                <CardTitle>User CRM Access</CardTitle>
              </CardHeader>
              <CardContent>
                <CRMAccessManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Pending & Past Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                <CRMInvitationsPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invite Modal */}
        <InviteUserModal 
          open={showInviteModal} 
          onOpenChange={setShowInviteModal} 
        />
      </div>
    </CRMLayout>
  );
}
