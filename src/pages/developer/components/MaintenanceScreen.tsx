import { AlertTriangle } from 'lucide-react';

export const MaintenanceScreen = () => (
  <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
    <div className="text-center max-w-md px-6">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h1 className="text-xl font-mono text-white mb-2 tracking-wide">SYSTEM MAINTENANCE</h1>
      <p className="text-sm text-[#666] font-mono leading-relaxed">
        Dynasty OS is currently undergoing scheduled maintenance. All services will be restored shortly.
      </p>
      <div className="mt-8 text-[10px] text-[#333] uppercase tracking-widest">
        Status: Lockdown Active
      </div>
    </div>
  </div>
);
