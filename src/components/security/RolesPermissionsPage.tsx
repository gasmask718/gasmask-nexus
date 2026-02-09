import { useState } from "react";
import { useUserRolesAdmin, useUpdateUserRole, useDeleteUserRole, useAddUserRole, APP_ROLES, type UserRoleRow } from "@/hooks/useUserRolesAdmin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Shield, Search, Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ROLE_PERMISSION_MATRIX, getPermissionsForRole } from "@/security/permissions";

export function RolesPermissionsPage() {
  const { data: roles, isLoading } = useUserRolesAdmin();
  const updateRole = useUpdateUserRole();
  const deleteRole = useDeleteUserRole();
  const addRole = useAddUserRole();

  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<UserRoleRow | null>(null);
  const [editRoleValue, setEditRoleValue] = useState("");
  const [editRoleName, setEditRoleName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRoleValue, setAddRoleValue] = useState("");
  const [addRoleName, setAddRoleName] = useState("");
  const [viewPermsRole, setViewPermsRole] = useState<string | null>(null);

  const filtered = (roles || []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      r.user_id.toLowerCase().includes(q)
    );
  });

  const roleCounts = (roles || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] || 0) + 1;
    return acc;
  }, {});

  const handleEdit = (row: UserRoleRow) => {
    setEditRow(row);
    setEditRoleValue(row.role);
    setEditRoleName(row.role_name || "");
  };

  const handleEditSave = () => {
    if (!editRow) return;
    updateRole.mutate({ id: editRow.id, role: editRoleValue, role_name: editRoleName || undefined }, {
      onSuccess: () => setEditRow(null),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteRole.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleAdd = () => {
    if (!addUserId || !addRoleValue) return;
    addRole.mutate({ user_id: addUserId, role: addRoleValue, role_name: addRoleName || undefined }, {
      onSuccess: () => { setAddOpen(false); setAddUserId(""); setAddRoleValue(""); setAddRoleName(""); },
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "owner") return "destructive" as const;
    if (role === "admin") return "default" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Roles & Permissions</h1>
            <p className="text-muted-foreground">Manage user roles, view permissions matrix</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Assign Role
        </Button>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(roleCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([role, count]) => (
          <Card key={role} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewPermsRole(role)}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{role.replace("_", " ")}</span>
                <Badge variant={getRoleBadgeVariant(role)}>{count}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, role, or user ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Badge variant="outline" className="ml-auto">
          <Users className="h-3 w-3 mr-1" /> {filtered.length} users
        </Badge>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Custom Label</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name || <span className="text-muted-foreground italic">No name</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(row.role)} className="capitalize cursor-pointer" onClick={() => setViewPermsRole(row.role)}>
                        {row.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{row.role_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(row.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permissions Matrix (click a role) */}
      {viewPermsRole && (
        <Card>
          <CardHeader>
            <CardTitle className="capitalize">Permissions: {viewPermsRole.replace("_", " ")}</CardTitle>
            <CardDescription>From the Dynasty OS Permission Matrix</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(getPermissionsForRole(viewPermsRole) || []).map((perm) => (
                <Badge key={perm} variant="outline" className="text-xs">{perm}</Badge>
              ))}
              {(getPermissionsForRole(viewPermsRole) || []).length === 0 && (
                <span className="text-muted-foreground text-sm">No permissions defined for this role</span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setViewPermsRole(null)}>Close</Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role for {editRow?.name || editRow?.email || editRow?.user_id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={editRoleValue} onValueChange={setEditRoleValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Custom Label (optional)</label>
              <Input value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} placeholder="e.g. Senior Manager" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateRole.isPending}>
              {updateRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role Assignment</AlertDialogTitle>
            <AlertDialogDescription>This will remove the role from the user. They will lose access to the associated portal.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Role Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to User</DialogTitle>
            <DialogDescription>Enter the user ID and select a role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">User ID</label>
              <Input value={addUserId} onChange={(e) => setAddUserId(e.target.value)} placeholder="UUID of the user" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={addRoleValue} onValueChange={setAddRoleValue}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Custom Label (optional)</label>
              <Input value={addRoleName} onChange={(e) => setAddRoleName(e.target.value)} placeholder="e.g. Regional Manager" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addUserId || !addRoleValue || addRole.isPending}>
              {addRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
