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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import {
  createInvitation,
  getInvitations,
  deleteInvitation,
  resendInvitation,
  getInviteLink,
  sendInviteEmail, // <--- 1. Import the new service function
  INVITE_ROLES,
  type Invitation,
} from "@/services/invitationService";
import { OSRole } from "@/config/osNavigation";
import { formatDistanceToNow } from "date-fns";

export default function UserInvitations() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<OSRole | "">("");
  const [assignedStoreId, setAssignedStoreId] = useState("");
  const [assignedRouteId, setAssignedRouteId] = useState("");
  const [assignedWarehouseId, setAssignedWarehouseId] = useState("");

  // State to track if email is sending separately from creation
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["user-invitations"],
    queryFn: async () => {
      const { invitations, error } = await getInvitations();
      if (error) throw new Error(error);
      return invitations;
    },
  });

  const createMutation = useMutation({
    mutationFn: createInvitation,
    onSuccess: async ({ invitation, error }) => {
      if (error) {
        toast.error(error);
        return;
      }

      // 2. Logic to send email immediately after creation
      if (invitation) {
        const link = getInviteLink(invitation.invite_token);

        // Auto-copy locally
        navigator.clipboard.writeText(link);

        try {
          setIsSendingEmail(true);
          toast.loading("Sending email invite...");

          // Call the emailer service
          await sendInviteEmail(invitation.email, invitation.role, link);

          toast.dismiss(); // Dismiss loading
          toast.success("Invitation created & email sent successfully!");
        } catch (emailError) {
          toast.dismiss();
          console.error(emailError);
          // We invite created, but email failed. User has the link in clipboard though.
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
      if (!success) {
        toast.error(error || "Failed to delete invitation");
        return;
      }
      toast.success("Invitation deleted");
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendInvitation,
    onSuccess: async ({ invitation, error }) => {
      if (error) {
        toast.error(error);
        return;
      }
      if (invitation) {
        const link = getInviteLink(invitation.invite_token);

        // 3. Also implement email logic on Resend
        try {
          toast.loading("Resending email...");
          await sendInviteEmail(invitation.email, invitation.role, link);
          toast.dismiss();
          toast.success("New link generated and email sent!");
        } catch (e) {
          toast.dismiss();
          navigator.clipboard.writeText(link);
          toast.warning("Email failed, but new link copied to clipboard.");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
  });

  const resetForm = () => {
    setEmail("");
    setPhone("");
    setRole("");
    setAssignedStoreId("");
    setAssignedRouteId("");
    setAssignedWarehouseId("");
  };

  const handleCreate = () => {
    if (!email || !role) {
      toast.error("Email and role are required");
      return;
    }
    createMutation.mutate({
      email,
      phone,
      role,
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
    if (invitation.accepted_at) {
      return (
        <Badge variant="default" className="bg-green-500">
          <Check className="h-3 w-3 mr-1" /> Accepted
        </Badge>
      );
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" /> Expired
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );
  };

  const getRoleLabel = (role: string) => {
    const found = INVITE_ROLES.find((r) => r.value === role);
    return found?.label || role;
  };

  const isInviteActive = (inv: Invitation) => {
    return !inv.accepted_at && new Date(inv.expires_at) > new Date();
  };

  const showStoreAssignment = role === "biker" || role === "ambassador";
  const showRouteAssignment = role === "driver";
  const showWarehouseAssignment = role === "production";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            User Invitations
          </h1>
          <p className="text-muted-foreground">Invite team members with pre-assigned roles and portal access</p>
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
                <EmailInput
                  id="email"
                  placeholder="team@example.com"
                  value={email}
                  onChange={setEmail}
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

              {/* Conditional Assignment Fields */}
              {showStoreAssignment && (
                <div className="space-y-2">
                  <Label htmlFor="storeId">Assign to Store (Optional)</Label>
                  <Input
                    id="storeId"
                    placeholder="Store ID (UUID)"
                    value={assignedStoreId}
                    onChange={(e) => setAssignedStoreId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Auto-assigned on signup</p>
                </div>
              )}

              {showRouteAssignment && (
                <div className="space-y-2">
                  <Label htmlFor="routeId">Assign to Route (Optional)</Label>
                  <Input
                    id="routeId"
                    placeholder="Route ID (UUID)"
                    value={assignedRouteId}
                    onChange={(e) => setAssignedRouteId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Auto-assigned on signup</p>
                </div>
              )}

              {showWarehouseAssignment && (
                <div className="space-y-2">
                  <Label htmlFor="warehouseId">Assign to Warehouse (Optional)</Label>
                  <Input
                    id="warehouseId"
                    placeholder="Warehouse ID (UUID)"
                    value={assignedWarehouseId}
                    onChange={(e) => setAssignedWarehouseId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Auto-assigned on signup</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || isSendingEmail}>
                {createMutation.isPending || isSendingEmail ? "Processing..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Invitations
          </CardTitle>
          <CardDescription>
            Invites expire after 72 hours. Users sign up → get role → land in their portal.
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
                        {isInviteActive(inv) && (
                          <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv)}>
                            {copiedId === inv.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!inv.accepted_at && (
                              <DropdownMenuItem
                                onClick={() => resendMutation.mutate(inv.id)}
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend Email
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(inv.id)}
                              disabled={deleteMutation.isPending}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
