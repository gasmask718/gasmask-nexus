import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UserPlus, Copy, Trash2, Check, Clock, XCircle, Link as LinkIcon, Send } from 'lucide-react';
import { createInvitation, getInvitations, deleteInvitation, getInviteLink, INVITE_ROLES, type Invitation } from '@/services/invitationService';
import { OSRole } from '@/config/osNavigation';
import { formatDistanceToNow } from 'date-fns';

export default function UserInvitations() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<OSRole | ''>('');

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: async () => {
      const { invitations, error } = await getInvitations();
      if (error) throw new Error(error);
      return invitations;
    }
  });

  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: ({ invitation, error }) => {
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Invitation created successfully');
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      setIsCreateOpen(false);
      resetForm();
      
      // Auto-copy the link
      if (invitation) {
        const link = getInviteLink(invitation.invite_token);
        navigator.clipboard.writeText(link);
        toast.success('Invite link copied to clipboard!');
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvitation,
    onSuccess: ({ success, error }) => {
      if (!success) {
        toast.error(error || 'Failed to delete invitation');
        return;
      }
      toast.success('Invitation deleted');
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
    }
  });

  const resetForm = () => {
    setEmail('');
    setPhone('');
    setRole('');
  };

  const handleCreate = () => {
    if (!email || !role) {
      toast.error('Email and role are required');
      return;
    }
    createMutation.mutate({ email, phone, role });
  };

  const copyInviteLink = async (invitation: Invitation) => {
    const link = getInviteLink(invitation.invite_token);
    await navigator.clipboard.writeText(link);
    setCopiedId(invitation.id);
    toast.success('Invite link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.accepted_at) {
      return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Accepted</Badge>;
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Expired</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
  };

  const getRoleLabel = (role: string) => {
    const found = INVITE_ROLES.find(r => r.value === role);
    return found?.label || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Invitations</h1>
          <p className="text-muted-foreground">Invite team members with pre-assigned roles</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Invite
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Invitation</DialogTitle>
              <DialogDescription>
                Generate a secure signup link for a new team member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="team@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OSRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.label}</span>
                          <span className="text-xs text-muted-foreground">{r.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create & Copy Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Active Invitations
          </CardTitle>
          <CardDescription>
            Manage pending and accepted invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invitations yet</p>
              <p className="text-sm">Create your first invitation to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRoleLabel(inv.role)}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(inv)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!inv.accepted_at && new Date(inv.expires_at) > new Date() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(inv)}
                          >
                            {copiedId === inv.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(inv.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
