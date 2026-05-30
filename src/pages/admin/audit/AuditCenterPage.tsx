import { useState } from 'react';
import { format } from 'date-fns';
import { Shield, Search, Filter, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuditSearch, useAuditIntegrity, useAuditTables } from '@/hooks/useAuditSystem';

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-500/10 text-green-500',
  UPDATE: 'bg-blue-500/10 text-blue-500',
  DELETE: 'bg-red-500/10 text-red-500',
};

export default function AuditCenterPage() {
  const [tableName, setTableName] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [actorRole, setActorRole] = useState<string>('');

  const { data: logs, isLoading } = useAuditSearch({
    tableName: tableName || undefined,
    action: action || undefined,
    actorRole: actorRole || undefined,
    limit: 100,
  });

  const { data: integrity } = useAuditIntegrity();
  const { data: tables } = useAuditTables();

  const totalBrokenLinks = integrity?.reduce((sum, i) => sum + Number(i.broken_links), 0) || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Audit Center</h1>
            <p className="text-muted-foreground">SOX-grade immutable audit trail</p>
          </div>
        </div>
        <Badge variant={totalBrokenLinks === 0 ? 'default' : 'destructive'} className="text-sm px-3 py-1">
          {totalBrokenLinks === 0 ? (
            <><CheckCircle className="h-4 w-4 mr-1" /> Chain Intact</>
          ) : (
            <><AlertTriangle className="h-4 w-4 mr-1" /> {totalBrokenLinks} Broken Links</>
          )}
        </Badge>
      </div>

      {/* Integrity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {integrity?.slice(0, 4).map((item) => (
          <Card key={item.table_name}>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">{item.table_name}</div>
              <div className="text-2xl font-bold">{item.rows_checked}</div>
              <div className="text-xs">
                {item.broken_links === 0 ? (
                  <span className="text-green-500">✓ Verified</span>
                ) : (
                  <span className="text-destructive">{item.broken_links} issues</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Search Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={tableName} onValueChange={setTableName}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Tables</SelectItem>
                {tables?.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actorRole} onValueChange={setActorRole}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="ambassador">Ambassador</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => { setTableName(''); setAction(''); setActorRole(''); }}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Changed Fields</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), 'MMM d, yyyy, h:mm:ss a')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] || ''}>{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.actor_role || 'system'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.changed_fields?.join(', ') || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{log.source || 'trigger'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
