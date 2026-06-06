/**
 * AmbassadorFieldSession — "Start Field Session" toggle for ambassadors.
 *
 * Tracking ONLY activates when:
 *   (a) An assigned route/visit run is active (handled elsewhere — same as drivers), OR
 *   (b) The ambassador explicitly taps "Start Field Session" here.
 *
 * While a session is active:
 *   • GPS is sampled every 30s and written to `location_events` (same table drivers/bikers use)
 *   • A row in `field_sessions` records started_at + last_ping + role='ambassador'
 *   • A visible "Location sharing ON" indicator is shown
 *   • Hard auto-stop at 10h (also enforced server-side via close_stale_field_sessions())
 *   • Manual Stop ends the session immediately
 *
 * Off-session: zero pings, zero rows written. No silent tracking.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navigation, Loader2, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';

const PING_INTERVAL_MS = 30_000;
const SAFETY_CAP_MS = 10 * 60 * 60 * 1000; // 10h

interface ActiveSession {
  id: string;
  started_at: string;
  last_ping_at: string | null;
}

export function AmbassadorFieldSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Resolve current user + any in-progress session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('field_sessions')
        .select('id, started_at, last_ping_at')
        .eq('user_id', user.id)
        .eq('role', 'ambassador')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        sessionIdRef.current = data.id;
        setSession(data);
        // If session is past safety cap, auto-close locally + server-side
        const age = Date.now() - new Date(data.started_at).getTime();
        if (age >= SAFETY_CAP_MS) {
          await endSession('auto_cap');
        } else {
          beginGpsLoop(SAFETY_CAP_MS - age);
        }
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1Hz clock for duration display
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  function teardown() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (capTimeoutRef.current) { clearTimeout(capTimeoutRef.current); capTimeoutRef.current = null; }
  }

  const sendPing = useCallback(async (lat: number, lng: number) => {
    const uid = userId;
    const sid = sessionIdRef.current;
    if (!uid || !sid) return;
    try {
      await supabase.from('location_events').insert({
        user_id: uid,
        event_type: 'gps_ping',
        lat,
        lng,
      });
      const ts = new Date().toISOString();
      await supabase
        .from('field_sessions')
        .update({ last_ping_at: ts, last_lat: lat, last_lng: lng })
        .eq('id', sid);
      setSession((s) => s ? { ...s, last_ping_at: ts } : s);
      setError(null);
    } catch (e: any) {
      console.error('[FieldSession] ping failed', e);
    }
  }, [userId]);

  function beginGpsLoop(msUntilCap: number) {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      (err) => {
        setError(
          err.code === 1 ? 'Location permission denied. Enable location access.'
          : err.code === 2 ? 'Location unavailable. Check GPS.'
          : 'Location request timed out.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        sendPing(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15_000 },
    );
    intervalRef.current = setInterval(() => {
      const c = lastCoordsRef.current;
      if (c) sendPing(c.lat, c.lng);
    }, PING_INTERVAL_MS);
    // Hard cap timer
    capTimeoutRef.current = setTimeout(() => { endSession('auto_cap'); }, Math.max(1000, msUntilCap));
  }

  async function startSession() {
    if (!userId || starting || session) return;
    setStarting(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from('field_sessions')
        .insert({
          user_id: userId,
          role: 'ambassador',
          trigger_source: 'manual',
        })
        .select('id, started_at, last_ping_at')
        .single();
      if (insErr) throw insErr;
      sessionIdRef.current = data.id;
      setSession(data);
      beginGpsLoop(SAFETY_CAP_MS);
      toast.success('Field Session started — location sharing ON');
    } catch (e: any) {
      setError(e.message || 'Failed to start session');
      toast.error('Could not start Field Session');
    } finally {
      setStarting(false);
    }
  }

  async function endSession(reason: 'manual' | 'auto_cap' = 'manual') {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setStopping(true);
    teardown();
    try {
      await supabase
        .from('field_sessions')
        .update({ ended_at: new Date().toISOString(), ended_reason: reason })
        .eq('id', sid);
      sessionIdRef.current = null;
      setSession(null);
      if (reason === 'auto_cap') {
        toast.info('Field Session auto-stopped (10h safety cap)');
      } else {
        toast.success('Field Session ended');
      }
    } catch (e: any) {
      toast.error('Failed to end session: ' + (e.message || 'unknown'));
    } finally {
      setStopping(false);
    }
  }

  if (loading) return null;

  const active = !!session;
  const startedMs = session ? new Date(session.started_at).getTime() : 0;
  const durSec = active ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
  const hh = Math.floor(durSec / 3600).toString().padStart(2, '0');
  const mm = Math.floor((durSec % 3600) / 60).toString().padStart(2, '0');
  const ss = (durSec % 60).toString().padStart(2, '0');
  const lastPing = session?.last_ping_at
    ? new Date(session.last_ping_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <Card className={`p-3 mb-4 border ${active ? 'border-emerald-500/40 bg-emerald-500/5' : ''}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Navigation className={`h-5 w-5 shrink-0 ${active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Field Session</span>
              {active ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block mr-1.5 animate-pulse" />
                  Location sharing ON
                </Badge>
              ) : (
                <Badge variant="secondary">Off</Badge>
              )}
            </div>
            {active ? (
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{hh}:{mm}:{ss}</span>
                {lastPing && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Last ping {lastPing}</span>}
                <span>Auto-stops at 10h</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Share your live position with dispatch while you're working a territory. No tracking when off.
              </p>
            )}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
        </div>
        <div className="ml-auto">
          {active ? (
            <Button size="sm" variant="destructive" onClick={() => endSession('manual')} disabled={stopping}>
              {stopping ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startSession} disabled={starting}>
              {starting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Start Field Session
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default AmbassadorFieldSession;
