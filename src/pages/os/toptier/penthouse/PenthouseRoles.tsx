import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Users, Key } from 'lucide-react';

export default function PenthouseRoles() {
  const { data: roles = [] } = useQuery({
    queryKey: ['ph-user-roles'],
    queryFn: () => fetchTopTierData('user_roles', { select: '*', order: 'created_at.desc' }),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['ph-role-permissions'],
    queryFn: () => fetchTopTierData('role_permissions', { select: '*' }),
  });

  const { data: permMatrix = [] } = useQuery({
    queryKey: ['ph-perm-matrix'],
    queryFn: () => fetchTopTierData('permissions_matrix', { select: '*' }),
  });

  // Group permissions by role
  const rolePerms = permissions.reduce((acc: Record<string, string[]>, p: any) => {
    if (!acc[p.role_name]) acc[p.role_name] = [];
    acc[p.role_name].push(p.permission);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Roles & Permissions</h1>
        <p className="text-white/40 text-sm mt-1">Manage user roles and permission assignments</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">User Roles</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{roles.length}</p>
            </div>
            <Shield className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Role Types</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{Object.keys(rolePerms).length}</p>
            </div>
            <Users className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Permission Keys</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{permMatrix.length}</p>
            </div>
            <Key className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
      </div>

      {/* User Roles Table */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader><CardTitle className="text-sm text-white/70">Assigned User Roles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">User ID</TableHead>
                <TableHead className="text-white/40">Role</TableHead>
                <TableHead className="text-white/40">Role Name</TableHead>
                <TableHead className="text-white/40">Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r: any) => (
                <TableRow key={r.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-white/50 text-xs font-mono">{r.user_id?.slice(0, 8)}…</TableCell>
                  <TableCell><Badge className="bg-[#C9A84C]/15 text-[#C9A84C] text-[10px]">{r.role}</Badge></TableCell>
                  <TableCell className="text-white/60 text-sm">{r.role_name || '—'}</TableCell>
                  <TableCell className="text-white/40 text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-white/30 py-8">No roles assigned</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader><CardTitle className="text-sm text-white/70">Role Permissions Matrix</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(rolePerms).length === 0 ? (
            <p className="text-white/30 text-center py-8">No role permissions configured</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(rolePerms).map(([role, perms]) => (
                <div key={role} className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
                  <p className="text-sm font-medium text-[#C9A84C] mb-2">{role}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(perms as string[]).map(p => (
                      <Badge key={p} variant="outline" className="text-[9px] border-white/10 text-white/50">{p}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card className="bg-[#111] border-white/5">
        <CardHeader><CardTitle className="text-sm text-white/70">Available Permissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Key</TableHead>
                <TableHead className="text-white/40">Name</TableHead>
                <TableHead className="text-white/40">Category</TableHead>
                <TableHead className="text-white/40">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permMatrix.map((p: any) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-xs font-mono text-[#C9A84C]">{p.permission_key}</TableCell>
                  <TableCell className="text-white/70 text-sm">{p.permission_name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] border-white/10 text-white/50">{p.category}</Badge></TableCell>
                  <TableCell className="text-white/40 text-sm max-w-[200px] truncate">{p.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
