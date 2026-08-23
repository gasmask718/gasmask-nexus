import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type AppRole =
  | 'admin' | 'csr' | 'driver' | 'biker' | 'ambassador' | 'wholesaler'
  | 'warehouse' | 'accountant' | 'employee' | 'store' | 'wholesale'
  | 'influencer' | 'customer' | 'pod_worker' | 'realestate_worker'
  | 'owner' | 'developer' | 'staff' | 'creator' | 'va' | 'production' | 'pending';

const ASSIGNABLE_ROLES: AppRole[] = [
  'admin', 'csr', 'driver', 'biker', 'ambassador', 'wholesaler', 'warehouse',
  'accountant', 'employee', 'store', 'influencer', 'customer', 'staff', 'va',
  'creator', 'production', 'pod_worker', 'realestate_worker', 'developer', 'owner',
];

export default function PendingUsers() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, AppRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {
      // Join user_roles -> profiles. Anyone holding a `pending` role row.
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role, profiles:profiles!user_roles_user_id_fkey(id, name, email, created_at)')
        .eq('role', 'pending')
        .order('user_id', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = async (userId: string) => {
    const newRole = selected[userId];
    if (!newRole) {
      toast.error('Pick a role first');
      return;
    }
    setSavingId(userId);
    try {
      // Insert the new role
      const { error: insErr } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      if (insErr && insErr.code !== '23505') throw insErr;

      // Remove the pending role
      const { error: delErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'pending');
      if (delErr) throw delErr;

      // Mirror onto profiles.role so legacy reads stay in sync
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (profErr) console.warn('profile role mirror failed:', profErr.message);

      toast.success(`Role updated to ${newRole}`);
      await qc.invalidateQueries({ queryKey: ['pending-users'] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Failed to update role');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Pending Users</h1>
          <p className="text-sm text-muted-foreground">
            Approve self-signed-up users by assigning them a role.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Awaiting Approval</CardTitle>
          <Badge variant="secondary">{data?.length ?? 0} pending</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No pending users.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Assign Role</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row: any) => {
                  const p = row.profiles;
                  const uid = row.user_id;
                  return (
                    <TableRow key={uid}>
                      <TableCell className="font-medium">{p?.name ?? '—'}</TableCell>
                      <TableCell>{p?.email ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p?.created_at ? new Date(p.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selected[uid] ?? ''}
                          onValueChange={(v) =>
                            setSelected((s) => ({ ...s, [uid]: v as AppRole }))
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-72">
                            {ASSIGNABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="capitalize">
                                {r.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!selected[uid] || savingId === uid}
                          onClick={() => approve(uid)}
                        >
                          {savingId === uid ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Approve'
                          )}
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
    </div>
  );
}
