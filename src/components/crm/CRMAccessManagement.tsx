import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  Search, 
  Users,
  Building2,
  RefreshCw,
  UserX,
  Eye,
  Edit,
  UserCog
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { 
  useCRMAccessList, 
  useUpdateCRMAccess, 
  useRevokeCRMAccess,
  type CRMAccess,
  type CRMAccessRole 
} from '@/hooks/useCRMAccess';
import { toast } from 'sonner';

export function CRMAccessManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCrm, setFilterCrm] = useState('all');

  const { data: accessRecords = [], isLoading, refetch } = useCRMAccessList();
  const updateAccess = useUpdateCRMAccess();
  const revokeAccess = useRevokeCRMAccess();

  // Get user profiles for the access records
  const userIds = [...new Set(accessRecords.map(a => a.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['access-user-profiles', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Get unique CRMs for filter
  const uniqueCrms = [...new Map(
    accessRecords.map(a => [a.crm_id, a.crm])
  ).values()].filter(Boolean);

  const filteredRecords = accessRecords.filter((record) => {
    const profile = profileMap.get(record.user_id);
    const matchesSearch = !searchTerm || 
      profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCrm = filterCrm === 'all' || record.crm_id === filterCrm;
    return matchesSearch && matchesCrm;
  });

  const getRoleIcon = (role: CRMAccessRole) => {
    switch (role) {
      case 'admin':
        return <UserCog className="h-3 w-3" />;
      case 'edit':
        return <Edit className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const getRoleBadgeVariant = (role: CRMAccessRole) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'edit':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleRoleChange = async (accessId: string, newRole: CRMAccessRole) => {
    await updateAccess.mutateAsync({ accessId, accessRole: newRole });
  };

  const handleRevoke = async (accessId: string) => {
    await revokeAccess.mutateAsync(accessId);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            CRM Access Management
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCrm} onValueChange={setFilterCrm}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by CRM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CRMs</SelectItem>
              {uniqueCrms.map((crm) => (
                <SelectItem key={crm?.id} value={crm?.id || ''}>
                  {crm?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Access Table */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
            <Users className="h-12 w-12 mb-3 opacity-50" />
            <p className="font-medium">No access records found</p>
            <p className="text-sm">
              {searchTerm || filterCrm !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Send invitations to grant users CRM access'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>CRM</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const profile = profileMap.get(record.user_id);
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">{profile?.name || 'Unknown User'}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{record.crm?.name || 'Unknown CRM'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={record.access_role}
                          onValueChange={(value) => handleRoleChange(record.id, value as CRMAccessRole)}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <Badge variant={getRoleBadgeVariant(record.access_role)} className="gap-1">
                              {getRoleIcon(record.access_role)}
                              {record.access_role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" /> View Only
                              </div>
                            </SelectItem>
                            <SelectItem value="edit">
                              <div className="flex items-center gap-2">
                                <Edit className="h-3 w-3" /> Edit
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-3 w-3" /> Admin
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(record.granted_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <UserX className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke Access</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {profile?.name || 'this user'}'s access to {record.crm?.name}. 
                                They will no longer be able to view or edit this CRM.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRevoke(record.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke Access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Stats */}
        <div className="flex gap-4 pt-4 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Total Users:</span>{' '}
            <span className="font-medium">{new Set(accessRecords.map(a => a.user_id)).size}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Access Grants:</span>{' '}
            <span className="font-medium">{accessRecords.length}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">CRMs with Access:</span>{' '}
            <span className="font-medium">{uniqueCrms.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
