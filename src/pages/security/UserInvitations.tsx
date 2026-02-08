import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  UserPlus,
  Copy,
  Trash2,
  Check,
  Clock,
  XCircle,
  Link as LinkIcon,
  MoreVertical,
  RefreshCw,
  Shield,
  Mail,
  ShieldOff,
  ShieldCheck,
  UserCheck,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  createInvitation,
  getInvitations,
  deleteInvitation,
  resendInvitation,
  revokeUserAccess,
  reinstateUserAccess,
  getInviteLink,
  getEffectiveStatus,
  sendInviteEmail,
  INVITE_ROLES,
  type Invitation,
  type InviteStatus,
} from "@/services/invitationService";
import { supabase } from "@/integrations/supabase/client";
import { OSRole } from "@/config/osNavigation";
import { formatDistanceToNow, format } from "date-fns";

export default function UserInvitations() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<OSRole | "">("");
  const [assignedStoreId, setAssignedStoreId] = useState("");
  const [assignedRouteId, setAssignedRouteId] = useState("");
  const [assignedWarehouseId, setAssignedWarehouseId] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<InviteStatus | "all">("all");

  // Fetch invitations with inviter profiles
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["user-invitations"],
    queryFn: async () => {
      const { invitations, error } = await getInvitations();
      if (error) throw new Error(error);
      return invitations;
    },
  });

  // Fetch profiles for inviter names
  const inviterIds = [...new Set(invitations.map(i => i.invited_by).filter(Boolean))];
  const acceptedUserIds = [...new Set(invitations.map(i => i.accepted_user_id).filter(Boolean))];
  const allUserIds = [...new Set([...inviterIds, ...acceptedUserIds])].filter(Boolean);

  const { data: profiles = [] } = useQuery({
    queryKey: ["invite-profiles", allUserIds.join(",")],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allUserIds as string[]);
      return data || [];
    },
    enabled: allUserIds.length > 0,
  });

  const getProfileName = (userId: string | null) => {
    if (!userId) return null;
    const profile = profiles.find((p: any) => p.id === userId);
    return profile ? (profile as any).full_name : userId.slice(0, 8) + '…';
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: async ({ invitation, error }) => {
      if (error) { toast.error(error); return; }
      if (invitation) {
        const link = getInviteLink(invitation.invite_token);
        navigator.clipboard.writeText(link);
        try {
          setIsSendingEmail(true);
          toast.loading("Sending email invite...");
          await sendInviteEmail(invitation.email, invitation.role, link);
          toast.dismiss();
          toast.success("Invitation created & email sent!");
        } catch {
          toast.dismiss();
          toast.warning("Invite created and copied, but email failed to send.");
        } finally {
          setIsSendingEmail(false);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvitation,
    onSuccess: ({ success, error }) => {
      if (!success) { toast.error(error || "Failed to delete"); return; }
      toast.success("Invitation deleted");
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendInvitation,
    onSuccess: async ({ invitation, error }) => {
      if (error) { toast.error(error); return; }
      if (invitation) {
        const link = getInviteLink(invitation.invite_token);
        try {
          toast.loading("Resending email...");
          await sendInviteEmail(invitation.email, invitation.role, link);
          toast.dismiss();
          toast.success("New link generated and email sent!");
        } catch {
          toast.dismiss();
          navigator.clipboard.writeText(link);
          toast.warning("Email failed, but new link copied to clipboard.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => revokeUserAccess(id, reason),
    onSuccess: ({ success, error }) => {
      if (!success) { toast.error(error || "Failed to revoke access"); return; }
      toast.success("Access revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
      setRevokeTarget(null);
      setRevokeReason("");
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: reinstateUserAccess,
    onSuccess: ({ success, error }) => {
      if (!success) { toast.error(error || "Failed to reinstate access"); return; }
      toast.success("Access reinstated successfully");
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const resetForm = () => {
    setEmail(""); setPhone(""); setRole("");
    setAssignedStoreId(""); setAssignedRouteId(""); setAssignedWarehouseId("");
  };

  const handleCreate = () => {
    if (!email || !role) { toast.error("Email and role are required"); return; }
    createMutation.mutate({
      email, phone, role,
      assigned_store_id: assignedStoreId || undefined,
      assigned_route_id: assignedRouteId || undefined,
      assigned_warehouse_id: assignedWarehouseId || undefined,
    });
  };

  const copyInviteLink = async (invitation: Invitation) => {
    const link = getInviteLink(invitation.invite_token);
    await navigator.clipboard.writeText(link);
    setCopiedId(invitation.id);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (invitation: Invitation) => {
    const status = getEffectiveStatus(invitation);
    switch (status) {
      case 'accepted':
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <UserCheck className="h-3 w-3 mr-1" /> Accepted
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive">
            <Ban className="h-3 w-3 mr-1" /> Revoked
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" /> Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> Sent
          </Badge>
        );
    }
  };

  const getRoleLabel = (role: string) => {
    const found = INVITE_ROLES.find((r) => r.value === role);
    return found?.label || role;
  };

  const isInviteActive = (inv: Invitation) => {
    const status = getEffectiveStatus(inv);
    return status === 'sent';
  };

  // Filtered invitations
  const filteredInvitations = invitations.filter(inv => {
    if (statusFilter === 'all') return true;
    return getEffectiveStatus(inv) === statusFilter;
  });

  // Stats
  const stats = {
    total: invitations.length,
    sent: invitations.filter(i => getEffectiveStatus(i) === 'sent').length,
    accepted: invitations.filter(i => getEffectiveStatus(i) === 'accepted').length,
    revoked: invitations.filter(i => getEffectiveStatus(i) === 'revoked').length,
    expired: invitations.filter(i => getEffectiveStatus(i) === 'expired').length,
  };

  const showStoreAssignment = role === "biker" || role === "ambassador";
  const showRouteAssignment = role === "driver";
  const showWarehouseAssignment = role === "production";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            User Invitations
          </h1>
          <p className="text-muted-foreground">Full lifecycle: invite → accept → active → revoke</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="h-4 w-4 mr-2" />
              Create & Email Invite
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Invitation</DialogTitle>
              <DialogDescription>
                Generates a signup link and <strong>automatically emails it</strong> to the user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <EmailInput id="email" placeholder="team@example.com" value={email} onChange={setEmail} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OSRole)}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
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
              {showStoreAssignment && (
                <div className="space-y-2">
                  <Label>Assign to Store (Optional)</Label>
                  <Input placeholder="Store ID (UUID)" value={assignedStoreId} onChange={(e) => setAssignedStoreId(e.target.value)} />
                </div>
              )}
              {showRouteAssignment && (
                <div className="space-y-2">
                  <Label>Assign to Route (Optional)</Label>
                  <Input placeholder="Route ID (UUID)" value={assignedRouteId} onChange={(e) => setAssignedRouteId(e.target.value)} />
                </div>
              )}
              {showWarehouseAssignment && (
                <div className="space-y-2">
                  <Label>Assign to Warehouse (Optional)</Label>
                  <Input placeholder="Warehouse ID (UUID)" value={assignedWarehouseId} onChange={(e) => setAssignedWarehouseId(e.target.value)} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || isSendingEmail}>
                {createMutation.isPending || isSendingEmail ? "Processing..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" count={stats.total} onClick={() => setStatusFilter('all')} active={statusFilter === 'all'} />
        <StatCard label="Sent" count={stats.sent} onClick={() => setStatusFilter('sent')} active={statusFilter === 'sent'} color="amber" />
        <StatCard label="Accepted" count={stats.accepted} onClick={() => setStatusFilter('accepted')} active={statusFilter === 'accepted'} color="green" />
        <StatCard label="Revoked" count={stats.revoked} onClick={() => setStatusFilter('revoked')} active={statusFilter === 'revoked'} color="red" />
        <StatCard label="Expired" count={stats.expired} onClick={() => setStatusFilter('expired')} active={statusFilter === 'expired'} color="gray" />
      </div>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Invitation Lifecycle
          </CardTitle>
          <CardDescription>
            Full audit trail: who was invited, who accepted, when, and current access status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{statusFilter === 'all' ? 'No invitations yet' : `No ${statusFilter} invitations`}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Accepted By</TableHead>
                  <TableHead>Accepted At</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.map((inv) => {
                  const effectiveStatus = getEffectiveStatus(inv);
                  return (
                    <TableRow key={inv.id} className={effectiveStatus === 'revoked' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(inv.role)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(inv)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getProfileName(inv.invited_by) || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.accepted_user_id ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <UserCheck className="h-3 w-3" />
                            {getProfileName(inv.accepted_user_id)}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.accepted_at ? (
                          <div className="space-y-0.5">
                            <div>{formatDistanceToNow(new Date(inv.accepted_at), { addSuffix: true })}</div>
                            <div className="text-xs opacity-60">{format(new Date(inv.accepted_at), 'PPp')}</div>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isInviteActive(inv) && (
                            <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv)}>
                              {copiedId === inv.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {effectiveStatus === 'sent' && (
                                <>
                                  <DropdownMenuItem onClick={() => resendMutation.mutate(inv.id)} disabled={resendMutation.isPending}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Resend Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copyInviteLink(inv)}>
                                    <Copy className="h-4 w-4 mr-2" /> Copy Invite Link
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => deleteMutation.mutate(inv.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Invite
                                  </DropdownMenuItem>
                                </>
                              )}
                              {effectiveStatus === 'accepted' && (
                                <DropdownMenuItem
                                  onClick={() => setRevokeTarget(inv)}
                                  className="text-destructive"
                                >
                                  <ShieldOff className="h-4 w-4 mr-2" /> Remove Access
                                </DropdownMenuItem>
                              )}
                              {effectiveStatus === 'revoked' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => reinstateMutation.mutate(inv.id)}
                                    disabled={reinstateMutation.isPending}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" /> Reinstate Access
                                  </DropdownMenuItem>
                                  {inv.revoke_reason && (
                                    <DropdownMenuItem disabled className="text-xs opacity-70">
                                      Reason: {inv.revoke_reason}
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                              {effectiveStatus === 'expired' && (
                                <DropdownMenuItem onClick={() => resendMutation.mutate(inv.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Re-invite
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revoke Access Confirmation Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) { setRevokeTarget(null); setRevokeReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-destructive" />
              Remove Access
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will immediately revoke <strong>{revokeTarget?.email}</strong>'s access
                  to the <strong>{revokeTarget?.role}</strong> portal.
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p>• User's role will be removed</p>
                  <p>• Portal access will be blocked immediately</p>
                  <p>• User account will NOT be deleted</p>
                  <p>• Action is logged and reversible</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revoke-reason">Reason (optional)</Label>
                  <Textarea
                    id="revoke-reason"
                    placeholder="Why is access being revoked?"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeTarget) {
                  revokeMutation.mutate({ id: revokeTarget.id, reason: revokeReason || undefined });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Stat card for the filter bar */
function StatCard({ label, count, onClick, active, color }: {
  label: string;
  count: number;
  onClick: () => void;
  active: boolean;
  color?: 'amber' | 'green' | 'red' | 'gray';
}) {
  const colorMap = {
    amber: 'text-amber-500',
    green: 'text-green-500',
    red: 'text-destructive',
    gray: 'text-muted-foreground',
  };

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className={`text-2xl font-bold ${color ? colorMap[color] : 'text-foreground'}`}>{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}
