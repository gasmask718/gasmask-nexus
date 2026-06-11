import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmailInput } from '@/components/ui/email-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Truck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Driver Portal Login - Isolated from Core Dynasty OS
 * - Validates driver role on login
 * - Blocks non-driver users
 * - Registers device for Phase 2 security hardening
 * - Logs all access attempts for audit
 */
export default function DriverLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Device registration helper
  const registerDevice = async (userId: string) => {
    const ua = navigator.userAgent;
    let platform = 'web';
    let browser = 'unknown';
    
    if (/iPhone|iPad|iPod/.test(ua)) platform = 'ios';
    else if (/Android/.test(ua)) platform = 'android';
    
    if (/Chrome/.test(ua)) browser = 'chrome';
    else if (/Safari/.test(ua)) browser = 'safari';
    else if (/Firefox/.test(ua)) browser = 'firefox';
    else if (/Edge/.test(ua)) browser = 'edge';

    // Simple fingerprint
    const components = [ua, navigator.language, screen.width + 'x' + screen.height, new Date().getTimezoneOffset()];
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    const fingerprint = Math.abs(hash).toString(16);

    // Check existing device
    const { data: existing } = await supabase
      .from('portal_devices')
      .select('id, is_revoked')
      .eq('user_id', userId)
      .eq('device_fingerprint', fingerprint)
      .maybeSingle();

    if (existing?.is_revoked) {
      throw new Error('This device has been revoked. Contact your administrator.');
    }

    if (existing) {
      await supabase.from('portal_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', existing.id);
      return;
    }

    // Register new device
    const { data: newDevice, error: insertError } = await supabase.from('portal_devices').insert({
      user_id: userId,
      portal_type: 'driver',
      device_fingerprint: fingerprint,
      device_name: `${platform} - ${browser}`,
      platform,
      browser,
    }).select().single();

    if (insertError) throw insertError;

    // Log new device event
    await supabase.from('portal_security_events').insert({
      user_id: userId,
      device_id: newDevice.id,
      portal_type: 'driver',
      event_type: 'new_device',
      severity: 'info',
      event_message: 'New device registered',
      metadata: { platform, browser },
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Authenticate
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Authentication failed');
        setIsLoading(false);
        return;
      }

      // Step 2: Check for portal role or elevated access
      // SOURCE OF TRUTH: user_roles table (per project RBAC standard).
      // Fallback to profiles.role for legacy single-role rows.
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id);

      let userRoles: string[] = (roleRows ?? []).map((r: any) => r.role);

      if (userRoles.length === 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if ((profile as any)?.role) userRoles = [(profile as any).role];
      }

      const elevatedRoles = ['owner', 'admin', 'ceo', 'va', 'employee'];
      const isElevated = userRoles.some((r) => elevatedRoles.includes(r));
      const isDriver = userRoles.includes('driver');

      if (!isDriver && !isElevated) {
        await supabase.from('portal_audit_log').insert([{
          user_id: authData.user.id,
          portal_type: 'driver',
          action_type: 'login_denied',
          metadata: { reason: 'role_mismatch', attempted_roles: userRoles }
        }]);

        await supabase.auth.signOut();
        setError('Access denied. You must be a driver to use this portal.');
        setIsLoading(false);
        return;
      }

      const userRole = isDriver ? 'driver' : userRoles[0];

      // Step 3: Register device (Phase 2 security)
      try {
        await registerDevice(authData.user.id);
      } catch (deviceErr: any) {
        await supabase.auth.signOut();
        setError(deviceErr.message || 'Device registration failed');
        setIsLoading(false);
        return;
      }

      // Step 4: Log successful login
      await supabase.from('portal_audit_log').insert([{
        user_id: authData.user.id,
        portal_type: 'driver',
        action_type: 'login',
        metadata: { success: true, role: userRole }
      }]);

      toast.success('Welcome to the Driver Portal');
      navigate('/portal/driver');
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Driver Portal</CardTitle>
          <CardDescription>Access your routes, deliveries, and shift management</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            This portal is for authorized drivers only.
            <br />
            Contact your manager if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
