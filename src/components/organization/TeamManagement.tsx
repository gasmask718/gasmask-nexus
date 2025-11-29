import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useOrganizationMembers, 
  useOrganizationInvites, 
  useOrganizationManagement,
  useCurrentOrgRole,
  OrganizationUser 
} from '@/services/organization/useOrganization';
import { useActivityLogs } from '@/services/organization/useActivityLog';
import { 
  OrgRole, 
  getRolesForOrgType, 
  getRoleDisplayName,
  hasPermission 
} from '@/services/organization/permissionEngine';
import { 
  UserPlus, 
  Users, 
  Shield, 
  Clock, 
  MoreVertical, 
  Mail,
  Copy,
  Trash2,
  Settings,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TeamManagementProps {
  orgId: string;
  orgType: 'store' | 'wholesaler';
}

export function TeamManagement({ orgId, orgType }: TeamManagementProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('support_staff');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const { data: members, isLoading: membersLoading } = useOrganizationMembers(orgId);
  const { data: invites, isLoading: invitesLoading } = useOrganizationInvites(orgId);
  const { data: currentRole } = useCurrentOrgRole(orgId);
  const { data: activityLogs } = useActivityLogs(orgId, 20);
  const { inviteMember, updateMemberRole, removeMember, cancelInvite } = useOrganizationManagement(orgId);

  const canManageStaff = currentRole && hasPermission(currentRole.permissions, 'manage_staff');
  const availableRoles = getRolesForOrgType(orgType);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    await inviteMember.mutateAsync({ email: inviteEmail, role: inviteRole });
    setInviteEmail('');
    setInviteDialogOpen(false);
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage your organization's staff and permissions</p>
        </div>
        {canManageStaff && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invite to add a new member to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.filter(r => r !== 'owner').map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleInvite}
                  disabled={inviteMember.isPending}
                >
                  {inviteMember.isPending ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members ({members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Mail className="h-4 w-4" />
            Pending Invites ({invites?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>People who have access to this organization</CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : !members?.length ? (
                <p className="text-muted-foreground">No team members yet</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      availableRoles={availableRoles}
                      canManage={canManageStaff && member.role !== 'owner'}
                      onUpdateRole={(role) => updateMemberRole.mutate({ memberId: member.id, role })}
                      onRemove={() => removeMember.mutate(member.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Invites that haven't been accepted yet</CardDescription>
            </CardHeader>
            <CardContent>
              {invitesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : !invites?.length ? (
                <p className="text-muted-foreground">No pending invites</p>
              ) : (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invite.invited_email}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{getRoleDisplayName(invite.invited_role)}</Badge>
                            <span>•</span>
                            <span>Expires {format(new Date(invite.expires_at), 'MMM d')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteCode(invite.invite_code)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          {invite.invite_code}
                        </Button>
                        {canManageStaff && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvite.mutate(invite.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent actions by team members</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {!activityLogs?.length ? (
                  <p className="text-muted-foreground">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">Staff</span>
                            {' '}
                            <span className="text-muted-foreground">{log.description}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Member row component
function MemberRow({ 
  member, 
  availableRoles, 
  canManage, 
  onUpdateRole, 
  onRemove 
}: {
  member: OrganizationUser;
  availableRoles: OrgRole[];
  canManage: boolean;
  onUpdateRole: (role: OrgRole) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={member.profile?.avatar_url || undefined} />
          <AvatarFallback>
            {(member.profile?.name || member.profile?.email || 'U')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{member.profile?.name || 'Unknown'}</p>
          <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
          {getRoleDisplayName(member.role)}
        </Badge>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {availableRoles.filter(r => r !== 'owner').map((role) => (
                <DropdownMenuItem 
                  key={role}
                  onClick={() => onUpdateRole(role)}
                >
                  Set as {getRoleDisplayName(role)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem 
                className="text-destructive"
                onClick={onRemove}
              >
                Remove from team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default TeamManagement;
