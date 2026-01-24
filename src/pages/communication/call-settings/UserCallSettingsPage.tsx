import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Phone, AlertTriangle, CheckCircle2, XCircle, MinusCircle, Edit2, Users, PhoneOff, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// E.164 phone format validation
const isValidE164 = (phone: string): boolean => {
  if (!phone) return false;
  // E.164: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
};

// Format phone for display
const formatPhoneDisplay = (phone: string | null): string => {
  if (!phone) return "—";
  // If it looks like US number, format nicely
  if (phone.startsWith("+1") && phone.length === 12) {
    return `${phone.slice(0, 2)} (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
  }
  return phone;
};

type CallStatus = "callable" | "disabled" | "missing_phone" | "invalid_phone";

interface UserCallProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  primary_role: string;
  is_callable: boolean;
}

function getCallStatus(user: UserCallProfile): CallStatus {
  if (!user.phone || user.phone.trim() === "") {
    return "missing_phone";
  }
  if (!isValidE164(user.phone)) {
    return "invalid_phone";
  }
  if (!user.is_callable) {
    return "disabled";
  }
  return "callable";
}

function CallStatusBadge({ status }: { status: CallStatus }) {
  switch (status) {
    case "callable":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Callable
        </Badge>
      );
    case "disabled":
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 gap-1">
          <MinusCircle className="h-3 w-3" />
          Disabled
        </Badge>
      );
    case "missing_phone":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Missing Phone
        </Badge>
      );
    case "invalid_phone":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Invalid Phone
        </Badge>
      );
  }
}

export default function UserCallSettingsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserCallProfile | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editCallable, setEditCallable] = useState(true);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Fetch all user profiles
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["user-call-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, phone, primary_role, is_callable")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return (data || []) as UserCallProfile[];
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, phone, isCallable }: { userId: string; phone: string | null; isCallable: boolean }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          phone: phone?.trim() || null,
          is_callable: isCallable,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-call-settings"] });
      queryClient.invalidateQueries({ queryKey: ["all-users-for-routes"] });
      toast.success("User call settings updated");
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.primary_role?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
    );
  }, [users, searchQuery]);

  // Compute stats
  const stats = useMemo(() => {
    const total = users.length;
    const callable = users.filter((u) => getCallStatus(u) === "callable").length;
    const disabled = users.filter((u) => getCallStatus(u) === "disabled").length;
    const missingPhone = users.filter((u) => getCallStatus(u) === "missing_phone").length;
    const invalidPhone = users.filter((u) => getCallStatus(u) === "invalid_phone").length;
    return { total, callable, disabled, missingPhone, invalidPhone };
  }, [users]);

  // Open edit modal
  const handleEdit = (user: UserCallProfile) => {
    setEditingUser(user);
    setEditPhone(user.phone || "");
    setEditCallable(user.is_callable);
    setPhoneError(null);
  };

  // Validate and save
  const handleSave = () => {
    if (!editingUser) return;

    const phone = editPhone.trim();

    // If callable is enabled, phone must be valid E.164
    if (editCallable && phone && !isValidE164(phone)) {
      setPhoneError("Phone must be in E.164 format (e.g., +1234567890)");
      return;
    }

    // If callable is enabled but no phone
    if (editCallable && !phone) {
      setPhoneError("Phone number is required to enable calling");
      return;
    }

    updateUserMutation.mutate({
      userId: editingUser.user_id,
      phone: phone || null,
      isCallable: editCallable,
    });
  };

  // Live validation in edit modal
  const liveStatus = useMemo((): CallStatus => {
    if (!editPhone.trim()) return "missing_phone";
    if (!isValidE164(editPhone.trim())) return "invalid_phone";
    if (!editCallable) return "disabled";
    return "callable";
  }, [editPhone, editCallable]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            User Call Settings
          </h1>
          <p className="text-muted-foreground">
            Configure which users can receive inbound calls. This is the single source of truth for telephony routing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-700 dark:text-green-400">Callable</CardDescription>
            <CardTitle className="text-2xl text-green-700 dark:text-green-400">{stats.callable}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-700 dark:text-yellow-400">Disabled</CardDescription>
            <CardTitle className="text-2xl text-yellow-700 dark:text-yellow-400">{stats.disabled}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-700 dark:text-red-400">Missing Phone</CardDescription>
            <CardTitle className="text-2xl text-red-700 dark:text-red-400">{stats.missingPhone}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-700 dark:text-orange-400">Invalid Phone</CardDescription>
            <CardTitle className="text-2xl text-orange-700 dark:text-orange-400">{stats.invalidPhone}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Warning if no callable users */}
      {stats.callable === 0 && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Callable Users</AlertTitle>
          <AlertDescription>
            There are no users configured to receive calls. All inbound calls will fall back to the Dynasty OS Kiosk.
            Add a valid phone number and enable calling for at least one user.
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, role, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users
          </CardTitle>
          <CardDescription>
            Manage phone numbers and callability for each user. Only users marked as "Callable" will receive inbound calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <PhoneOff className="h-12 w-12 mb-2 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Callable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const status = getCallStatus(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || <span className="text-muted-foreground italic">Unnamed</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.primary_role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhoneDisplay(user.phone)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.is_callable}
                          disabled
                          className={cn(
                            user.is_callable ? "data-[state=checked]:bg-green-600" : ""
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <CallStatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                          className="gap-1"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Call Settings</DialogTitle>
            <DialogDescription>
              Configure phone number and callability for{" "}
              <strong>{editingUser?.full_name || "this user"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={editPhone}
                onChange={(e) => {
                  setEditPhone(e.target.value);
                  setPhoneError(null);
                }}
                className={cn(phoneError && "border-destructive")}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be in E.164 format (e.g., +1234567890 for US numbers)
              </p>
            </div>

            {/* Callable Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Callable</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this user can receive inbound calls
                </p>
              </div>
              <Switch
                checked={editCallable}
                onCheckedChange={(checked) => {
                  setEditCallable(checked);
                  setPhoneError(null);
                }}
              />
            </div>

            {/* Live Status Preview */}
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Preview Status
              </Label>
              <CallStatusBadge status={liveStatus} />
            </div>

            {/* Warning for callable without phone */}
            {editCallable && !editPhone.trim() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  A valid phone number is required to enable calling.
                </AlertDescription>
              </Alert>
            )}

            {/* Warning for invalid phone */}
            {editPhone.trim() && !isValidE164(editPhone.trim()) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This phone number is not in valid E.164 format. Calls will not be routed to this user.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
