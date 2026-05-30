import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Ban, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * OpsDeviceManager — Admin panel for viewing & revoking portal devices
 */
export default function OpsDeviceManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: devices, isLoading } = useQuery({
    queryKey: ['portal-devices-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_devices')
        .select('*')
        .order('last_seen_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const revokeDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('portal_devices')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: 'Admin revocation',
        })
        .eq('id', deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Device revoked');
      queryClient.invalidateQueries({ queryKey: ['portal-devices-admin'] });
    },
  });

  const restoreDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('portal_devices')
        .update({
          is_revoked: false,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
          is_trusted: true,
        })
        .eq('id', deviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Device restored');
      queryClient.invalidateQueries({ queryKey: ['portal-devices-admin'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Portal Devices
          {devices && <Badge variant="outline">{devices.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {devices?.map(device => (
              <div key={device.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {device.is_revoked ? (
                      <ShieldX className="h-4 w-4 text-destructive shrink-0" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {device.device_name || 'Unknown Device'}
                    </span>
                    <Badge variant={device.is_revoked ? 'destructive' : 'default'} className="text-[10px]">
                      {device.portal_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {device.platform} · {device.browser}
                    {' · Last seen '}
                    {format(new Date(device.last_seen_at), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
                <div className="shrink-0 ml-2">
                  {device.is_revoked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreDevice.mutate(device.id)}
                      disabled={restoreDevice.isPending}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeDevice.mutate(device.id)}
                      disabled={revokeDevice.isPending}
                    >
                      <Ban className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(!devices || devices.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No devices registered yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
