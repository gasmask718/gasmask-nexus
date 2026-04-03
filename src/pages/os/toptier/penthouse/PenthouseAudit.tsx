import { useQuery } from '@tanstack/react-query';
import { fetchTopTierData } from '@/lib/toptierApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Clock } from 'lucide-react';

export default function PenthouseAudit() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['ph-audit-logs'],
    queryFn: () => fetchTopTierData('admin_audit_log', { select: '*', order: 'created_at.desc', limit: 100 }),
  });

  const actionColor = (action: string) => {
    if (action.includes('create') || action.includes('approve')) return 'bg-emerald-500/20 text-emerald-400';
    if (action.includes('delete') || action.includes('suspend') || action.includes('reject')) return 'bg-red-500/20 text-red-400';
    if (action.includes('update') || action.includes('edit')) return 'bg-blue-500/20 text-blue-400';
    return 'bg-white/10 text-white/40';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-[#C9A84C]">Audit Logs</h1>
        <p className="text-white/40 text-sm mt-1">Complete history of administrative actions</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Total Log Entries</p>
              <p className="text-2xl font-bold text-[#C9A84C] mt-1">{logs.length}</p>
            </div>
            <FileText className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-white/5">
          <CardContent className="p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Latest Entry</p>
              <p className="text-sm text-white/60 mt-1">
                {logs[0] ? new Date(logs[0].created_at).toLocaleString() : 'None'}
              </p>
            </div>
            <Clock className="h-5 w-5 text-[#C9A84C]/50" />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#111] border-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-white/70">Action History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Timestamp</TableHead>
                <TableHead className="text-white/40">Action</TableHead>
                <TableHead className="text-white/40">Target</TableHead>
                <TableHead className="text-white/40">Admin</TableHead>
                <TableHead className="text-white/40">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-white/50 text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge className={`text-[10px] ${actionColor(log.action)}`}>{log.action}</Badge></TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs text-white/60">{log.target_type}</p>
                      {log.target_id && <p className="text-[10px] text-white/30 font-mono">{log.target_id.slice(0, 8)}…</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-white/40 font-mono">{log.actor_user_id?.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs text-white/40 max-w-[200px] truncate">{log.reason || '—'}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-white/30 py-8">
                    {isLoading ? 'Loading...' : 'No audit logs found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
