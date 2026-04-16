/**
 * Developer Portal - DAW-Inspired QA Dashboard
 * Restricted to admin123@gmail.com and dev@gmail.com
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DevKillSwitch } from './components/DevKillSwitch';
import { DevLeadTable } from './components/DevLeadTable';
import { DevAuditLog } from './components/DevAuditLog';
import { DevSystemMonitor } from './components/DevSystemMonitor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Database, Activity, Terminal, AlertTriangle } from 'lucide-react';

const ALLOWED_EMAILS = ['admin123@gmail.com', 'dev@gmail.com'];

const DeveloperPortal = () => {
  const { user, loading } = useAuth();
  const [activeFunnel, setActiveFunnel] = useState('brandaro');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#00ff88] font-mono text-sm animate-pulse">
          INITIALIZING DEV ENVIRONMENT...
        </div>
      </div>
    );
  }

  if (!user || !ALLOWED_EMAILS.includes(user.email || '')) {
    return <Navigate to="/auth" replace />;
  }

  const funnels = [
    { key: 'brandaro', label: 'BRANDARO', table: 'brandaro_qualified_leads' },
    { key: 'stores', label: 'STORES', table: 'store_master' },
    { key: 'ambassadors', label: 'AMBASSADORS', table: 'ambassador_leads' },
    { key: 'solar', label: 'SOLAR', table: 'solar_leads' },
    { key: 'funding', label: 'FUNDING', table: 'leads_raw' },
    { key: 'surplus', label: 'SURPLUS', table: 'surplus_funds_leads' },
    { key: 'brandaro_ads', label: 'AD LEADS', table: 'brandaro_ad_leads' },
    { key: 'brandaro_clean', label: 'CLEAN LEADS', table: 'brandaro_clean_leads' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#c8c8d0] font-mono">
      {/* DAW Header Bar */}
      <header className="border-b border-[#1a1a2e] bg-[#0d0d15] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse" />
          <span className="text-xs uppercase tracking-[0.3em] text-[#00ff88]">
            Developer Console
          </span>
          <span className="text-[10px] text-[#555] ml-2">
            v2.0.0 | {user.email}
          </span>
        </div>
        <DevKillSwitch userEmail={user.email || ''} />
      </header>

      <div className="flex h-[calc(100vh-52px)]">
        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Funnel Selector - DAW Channel Strip */}
          <div className="border-b border-[#1a1a2e] bg-[#0d0d15]/80 px-2 py-1 flex gap-1 overflow-x-auto">
            {funnels.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFunnel(f.key)}
                className={`px-3 py-1.5 text-[10px] uppercase tracking-widest rounded transition-all whitespace-nowrap ${
                  activeFunnel === f.key
                    ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_12px_rgba(0,255,136,0.1)]'
                    : 'text-[#555] hover:text-[#888] hover:bg-[#1a1a2e]/50 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Data Grid */}
          <div className="flex-1 overflow-auto p-3">
            <DevLeadTable
              funnel={funnels.find(f => f.key === activeFunnel)!}
              userEmail={user.email || ''}
            />
          </div>
        </div>

        {/* Right Sidebar - Monitor Panel */}
        <div className="w-80 border-l border-[#1a1a2e] bg-[#0b0b14] flex flex-col overflow-hidden">
          <Tabs defaultValue="monitor" className="flex flex-col h-full">
            <TabsList className="bg-[#0d0d15] border-b border-[#1a1a2e] rounded-none h-8 p-0">
              <TabsTrigger
                value="monitor"
                className="text-[10px] uppercase tracking-widest rounded-none data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-[#00ff88] h-full"
              >
                <Activity className="w-3 h-3 mr-1" /> SYS
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="text-[10px] uppercase tracking-widest rounded-none data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-[#00ff88] h-full"
              >
                <Terminal className="w-3 h-3 mr-1" /> LOG
              </TabsTrigger>
            </TabsList>
            <TabsContent value="monitor" className="flex-1 overflow-auto m-0 p-0">
              <DevSystemMonitor />
            </TabsContent>
            <TabsContent value="audit" className="flex-1 overflow-auto m-0 p-0">
              <DevAuditLog />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default DeveloperPortal;
