import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Database, HardDrive, Cpu, Clock } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  latency?: number;
  detail?: string;
}

export const DevSystemMonitor = () => {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [uptime, setUptime] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 30000);
    const uptimeInterval = setInterval(() => setUptime(u => u + 1), 1000);
    return () => { clearInterval(interval); clearInterval(uptimeInterval); };
  }, []);

  const runChecks = async () => {
    const results: HealthCheck[] = [];

    // DB connectivity
    const dbStart = Date.now();
    const { error: dbErr } = await supabase.from('profiles').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;
    results.push({
      name: 'Database Connection',
      status: dbErr ? 'error' : dbLatency > 2000 ? 'warn' : 'ok',
      latency: dbLatency,
      detail: dbErr ? dbErr.message : `${dbLatency}ms`,
    });

    // Auth service
    const authStart = Date.now();
    const { data: session } = await supabase.auth.getSession();
    const authLatency = Date.now() - authStart;
    results.push({
      name: 'Auth Service',
      status: session ? 'ok' : 'warn',
      latency: authLatency,
      detail: session?.session ? 'Active session' : 'No session',
    });

    // Key tables health
    const tables = ['brandaro_qualified_leads', 'solar_leads', 'ambassador_leads', 'store_master', 'leads_raw', 'surplus_funds_leads'];
    for (const t of tables) {
      const start = Date.now();
      const { count, error } = await supabase.from(t as any).select('*', { count: 'exact', head: true });
      const lat = Date.now() - start;
      results.push({
        name: t.replace(/_/g, ' '),
        status: error ? 'error' : 'ok',
        latency: lat,
        detail: error ? error.message : `${count ?? 0} rows | ${lat}ms`,
      });
    }

    setChecks(results);
    setLastCheck(new Date());
  };

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusColor = (s: string) => {
    if (s === 'ok') return 'text-[#00ff88]';
    if (s === 'warn') return 'text-yellow-400';
    return 'text-red-400';
  };

  const statusDot = (s: string) => {
    if (s === 'ok') return 'bg-[#00ff88] shadow-[0_0_6px_#00ff88]';
    if (s === 'warn') return 'bg-yellow-400 shadow-[0_0_6px_#eab308]';
    return 'bg-red-400 shadow-[0_0_6px_#f87171]';
  };

  return (
    <div className="p-3 space-y-3">
      {/* Session Uptime */}
      <div className="bg-[#0d0d15] border border-[#1a1a2e] rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-widest text-[#555]">Session Uptime</span>
          <Clock className="w-3 h-3 text-[#555]" />
        </div>
        <div className="text-lg font-mono text-[#00ff88] tracking-wider">
          {formatUptime(uptime)}
        </div>
        {lastCheck && (
          <div className="text-[9px] text-[#333] mt-1">
            Last check: {lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Health Checks */}
      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-widest text-[#555] px-1 mb-2">System Health</div>
        {checks.map((check, i) => (
          <div key={i} className="bg-[#0d0d15] border border-[#1a1a2e] rounded px-3 py-2 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${statusDot(check.status)}`} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-[#888] truncate capitalize">{check.name}</div>
              <div className={`text-[9px] font-mono ${statusColor(check.status)}`}>
                {check.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
