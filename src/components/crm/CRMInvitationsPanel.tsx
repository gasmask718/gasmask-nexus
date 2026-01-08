import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Building2,
  RefreshCw,
  Copy,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useCRMInvitations, useRevokeCRMInvite, useResendCRMInvite, type CRMInvitation } from '@/hooks/useCRMAccess';
import { InviteUserModal } from './InviteUserModal';
import { toast } from 'sonner';

export function CRMInvitationsPanel() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: invitations = [], isLoading, refetch } = useCRMInvitations();
  const revokeInvite = useRevokeCRMInvite();
  const resendInvite = useResendCRMInvite();

  const filteredInvitations = invitations.filter((inv) =>
    inv.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'accepted':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Accepted</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'edit':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleCopyToken = (token: string) => {
    const inviteUrl = `${window.location.origin}/crm/accept-invite?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied to clipboard');
  };

  const handleRevoke = async (invitation: CRMInvitation) => {
    if (invitation.status !== 'pending') return;
    await revokeInvite.mutateAsync(invitation.id);
  };

  const handleResend = async (invitation: CRMInvitation) => {
    await resendInvite.mutateAsync(invitation);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              User Invitations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Invitations Table */}
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              <Mail className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">No invitations found</p>
              <p className="text-sm">
                {searchTerm ? 'Try a different search term' : 'Click "Invite User" to send your first invitation'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>CRM Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{invitation.email}</p>
                          {invitation.inviter && (
                            <p className="text-xs text-muted-foreground">
                              by {invitation.inviter.name || invitation.inviter.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {invitation.assignments?.map((assignment) => (
                            <Badge 
                              key={assignment.id} 
                              variant={getRoleBadgeVariant(assignment.access_role)}
                              className="text-xs"
                            >
                              <Building2 className="h-3 w-3 mr-1" />
                              {assignment.crm?.name || 'CRM'} ({assignment.access_role})
                            </Badge>
                          ))}
                          {(!invitation.assignments || invitation.assignments.length === 0) && (
                            <span className="text-muted-foreground text-sm">No CRMs assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invitation.status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                        </div>
                        {invitation.status === 'pending' && (
                          <div className="text-xs text-muted-foreground">
                            Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {invitation.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleCopyToken(invitation.invite_token)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Invite Link
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleRevoke(invitation)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Revoke Invitation
                                </DropdownMenuItem>
                              </>
                            )}
                            {(invitation.status === 'expired' || invitation.status === 'revoked') && (
                              <DropdownMenuItem 
                                onClick={() => handleResend(invitation)}
                                disabled={resendInvite.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Send New Invitation
                              </DropdownMenuItem>
                            )}
                            {invitation.status === 'accepted' && (
                              <DropdownMenuItem disabled>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Already Accepted
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Stats */}
          <div className="flex gap-4 pt-4 border-t">
            <div className="text-sm">
              <span className="text-muted-foreground">Pending:</span>{' '}
              <span className="font-medium">{invitations.filter(i => i.status === 'pending').length}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Accepted:</span>{' '}
              <span className="font-medium text-green-600">{invitations.filter(i => i.status === 'accepted').length}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Expired:</span>{' '}
              <span className="font-medium">{invitations.filter(i => i.status === 'expired').length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <InviteUserModal 
        open={showInviteModal} 
        onOpenChange={setShowInviteModal} 
      />
    </>
  );
}
