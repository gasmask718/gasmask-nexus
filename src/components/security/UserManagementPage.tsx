import { useState, useMemo } from "react";
import { useUsersAdmin, useUpdateProfile, type UserRow } from "@/hooks/useUsersAdmin";
import { useAddUserRole, useDeleteUserRole, APP_ROLES, type AppRole } from "@/hooks/useUserRolesAdmin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteConfirmModal } from "@/components/crud/DeleteConfirmModal";
import { Search, Edit, Trash2, Plus, Users, ShieldCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function UserManagementPage() {
  const { data: users, isLoading } = useUsersAdmin();
  const updateProfile = useUpdateProfile();
  const addRole = useAddUserRole();
  const deleteRole = useDeleteUserRole();

  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [addRoleUser, setAddRoleUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const [deleteRoleTarget, setDeleteRoleTarget] = useState<{ roleId: string; userName: string; roleName: string } | null>(null);

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.system_roles.some(r => r.role.toLowerCase().includes(q))
    );
  }, [users, search]);

  const stats = useMemo(() => {
    if (!users) return { total: 0, withRoles: 0, admins: 0 };
    return {
      total: users.length,
      withRoles: users.filter(u => u.system_roles.length > 0).length,
      admins: users.filter(u => u.system_roles.some(r => r.role === 'admin' || r.role === 'owner')).length,
    };
  }, [users]);

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setEditName(user.name || "");
    setEditPhone(user.phone || "");
  };

  const saveEdit = () => {
    if (!editUser) return;
    updateProfile.mutate({ id: editUser.id, name: editName, phone: editPhone }, {
      onSuccess: () => setEditUser(null),
    });
  };

  const handleAddRole = () => {
    if (!addRoleUser || !newRole) return;
    addRole.mutate({ user_id: addRoleUser.id, role: newRole }, {
      onSuccess: () => { setAddRoleUser(null); setNewRole(""); },
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground text-sm">Manage users, profiles, and role assignments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Users" value={stats.total} />
        <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="With System Roles" value={stats.withRoles} />
        <StatCard icon={<ShieldCheck className="h-5 w-5 text-destructive" />} label="Admins / Owners" value={stats.admins} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Profile Role</TableHead>
                <TableHead>System Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
              ) : filtered.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {(!user.name || user.name.trim().toLowerCase() === 'new user') ? (
                        <>
                          <span className="text-muted-foreground">{user.name || "—"}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 dark:text-amber-400">New User</Badge>
                        </>
                      ) : user.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.email || "—"}</TableCell>
                  <TableCell className="text-sm">{user.phone || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => {
                        if (value !== user.role) {
                          updateProfile.mutate({ id: user.id, role: value });
                        }
                      }}
                      disabled={updateProfile.isPending}
                    >
                      <SelectTrigger className="h-8 w-[150px] capitalize text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APP_ROLES.map(r => (
                          <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.system_roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : user.system_roles.map(r => (
                        <div key={r.id} className="flex items-center gap-0.5">
                          <Badge variant="secondary" className="capitalize text-xs">{r.role}</Badge>
                          <button
                            onClick={() => setDeleteRoleTarget({ roleId: r.id, userName: user.name, roleName: r.role })}
                            className="text-destructive hover:text-destructive/80 p-0.5"
                            title="Remove role"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)} title="Edit profile">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setAddRoleUser(user); setNewRole(""); }} title="Add role">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User Profile</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={!!addRoleUser} onOpenChange={open => { if (!open) setAddRoleUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Role to {addRoleUser?.name}</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                {APP_ROLES.map(r => (
                  <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleUser(null)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={!newRole || addRole.isPending}>
              {addRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Confirm */}
      <DeleteConfirmModal
        open={!!deleteRoleTarget}
        onOpenChange={open => { if (!open) setDeleteRoleTarget(null); }}
        title="Remove Role"
        itemName={`${deleteRoleTarget?.roleName} from ${deleteRoleTarget?.userName}`}
        onConfirm={async () => {
          if (deleteRoleTarget) await deleteRole.mutateAsync(deleteRoleTarget.roleId);
        }}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className="rounded-md bg-muted p-2">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
