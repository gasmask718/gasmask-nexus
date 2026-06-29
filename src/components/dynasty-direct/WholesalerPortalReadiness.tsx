/**
 * Wholesaler Portal Readiness — Phase 2 invite tracking.
 * Lists every wholesaler and whether they have a portal (auth-linked) account yet.
 * Admins can send a magic-link invite per row.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Row = {
  id: string;
  name: string;
  contact_email: string | null;
  profile_id: string | null;
  user_id: string | null;
  migration_status: 'has_portal_account' | 'needs_portal_account';
};

export function WholesalerPortalReadiness() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Row | null>(null);
  const [sending, setSending] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['dd-wholesaler-migration-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dd_wholesaler_migration_status' as any)
        .select('*');
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const ready = rows.filter((r) => r.migration_status === 'has_portal_account').length;
    const pct = total ? Math.round((ready / total) * 100) : 0;
    return { total, ready, pct, needs: total - ready };
  }, [rows]);

  const handleSend = async () => {
    if (!target?.contact_email) {
      toast.error('No email on file for this wholesaler');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-wholesaler-invite', {
        body: {
          wholesaler_id: target.id,
          email: target.contact_email,
          name: target.name,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(
          data.email_sent
            ? `Invite sent to ${target.contact_email}`
            : `Invite link generated (email service not configured)`,
        );
        setTarget(null);
        queryClient.invalidateQueries({ queryKey: ['dd-wholesaler-migration-status'] });
      } else {
        toast.error(data?.error || 'Failed to send invite');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Phase 2 Portal Readiness
            </CardTitle>
            <CardDescription>
              Wholesalers need portal accounts before self-serve onboarding can be enabled.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-base font-mono">
            {stats.ready} / {stats.total} ready
          </Badge>
        </div>
        <div className="mt-3 space-y-1">
          <Progress value={stats.pct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats.pct}% have portal accounts · {stats.needs} pending invite
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading wholesalers…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No wholesalers found.</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Wholesaler</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ready = r.migration_status === 'has_portal_account';
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.contact_email || <span className="italic">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {ready ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300">
                            Portal active
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300">
                            Needs portal
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!ready && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!r.contact_email}
                            onClick={() => setTarget(r)}
                          >
                            <Mail className="h-3.5 w-3.5 mr-1" />
                            Invite to Portal
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send portal invite to {target?.name}?</DialogTitle>
            <DialogDescription>
              We'll email a magic link so they can set up their Dynasty Direct supplier portal account.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="text-xs text-muted-foreground">Email</div>
            <div className="font-mono">{target?.contact_email}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default WholesalerPortalReadiness;
