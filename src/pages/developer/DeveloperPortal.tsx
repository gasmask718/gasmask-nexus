/**
 * Developer Portal - DAW-Inspired QA Dashboard
 * Restricted to admin123@gmail.com and dev@gmail.com
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { DevKillSwitch } from './components/DevKillSwitch';
import { DevLeadTable } from './components/DevLeadTable';
import { DevAuditLog } from './components/DevAuditLog';
import { DevSystemMonitor } from './components/DevSystemMonitor';
import { DevCommandPalette } from './components/DevCommandPalette';
import { DevRowDrawer } from './components/DevRowDrawer';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Activity, Terminal, Command, Rows3, AlignJustify, X } from 'lucide-react';

const ALLOWED_EMAILS = ['admin123@gmail.com', 'dev@gmail.com'];

const FUNNELS = [
  { key: 'brandaro', label: 'BRANDARO', table: 'brandaro_qualified_leads' },
  { key: 'stores', label: 'STORES', table: 'store_master' },
  { key: 'ambassadors', label: 'AMBASSADORS', table: 'ambassador_leads' },
  { key: 'solar', label: 'SOLAR', table: 'solar_leads' },
  { key: 'funding', label: 'FUNDING', table: 'leads_raw' },
  { key: 'surplus', label: 'SURPLUS', table: 'surplus_funds_leads' },
  { key: 'brandaro_ads', label: 'AD LEADS', table: 'brandaro_ad_leads' },
  { key: 'brandaro_clean', label: 'CLEAN LEADS', table: 'brandaro_clean_leads' },
];

type Density = 'comfortable' | 'compact';

const DeveloperPortal = () => {
  const { user, loading } = useAuth();
  const [activeFunnels, setActiveFunnels] = useState<string[]>(['brandaro']);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [density, setDensity] = useState<Density>('comfortable');
  const [drawerRow, setDrawerRow] = useState<any | null>(null);
  const [drawerTable, setDrawerTable] = useState('');
  const [drawerFunnelKey, setDrawerFunnelKey] = useState('');
  const [rightPanelTab, setRightPanelTab] = useState<'monitor' | 'audit'>('monitor');

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleFunnel = (key: string) => {
    setActiveFunnels(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(f => f !== key) : prev
        : [...prev, key]
    );
  };

  const removeFunnel = (key: string) => {
    if (activeFunnels.length > 1) {
      setActiveFunnels(prev => prev.filter(f => f !== key));
    }
  };

  const openDrawer = (row: any, table: string, funnelKey: string) => {
    setDrawerRow(row);
    setDrawerTable(table);
    setDrawerFunnelKey(funnelKey);
  };

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

  const activeFunnelConfigs = FUNNELS.filter(f => activeFunnels.includes(f.key));

  return (
    <div className="h-screen bg-[#0a0a0f] text-[#c8c8d0] font-mono flex flex-col overflow-hidden">
      {/* ═══ DAW Header Bar ═══ */}
      <header className="border-b border-[#1a1a2e] bg-[#0d0d15] px-4 py-2.5 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88] animate-pulse" />
          <span className="text-xs uppercase tracking-[0.3em] text-[#00ff88]">
            Developer Console
          </span>
          <span className="text-[10px] text-[#555] ml-2">
            v2.1.0 | {user.email}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Cmd+K trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a2e] rounded border border-[#2a2a3e] text-[10px] text-[#555] hover:text-[#888] hover:border-[#3a3a4e] transition-colors"
          >
            <Command className="w-3 h-3" />
            <span>Search</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-[#0a0a0f] rounded text-[9px] border border-[#2a2a3e]">⌘K</kbd>
          </button>
          {/* Density toggle */}
          <div className="flex bg-[#1a1a2e] rounded border border-[#2a2a3e] overflow-hidden">
            <button
              onClick={() => setDensity('comfortable')}
              className={`p-1.5 transition-colors ${density === 'comfortable' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'text-[#555] hover:text-[#888]'}`}
              title="Comfortable view"
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`p-1.5 transition-colors ${density === 'compact' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'text-[#555] hover:text-[#888]'}`}
              title="Compact view"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>
          <DevKillSwitch userEmail={user.email || ''} />
        </div>
      </header>

      {/* ═══ Faceted Filter Pills ═══ */}
      <div className="border-b border-[#1a1a2e] bg-[#0d0d15]/80 px-4 py-2 flex items-center gap-2 shrink-0">
        <span className="text-[9px] uppercase tracking-widest text-[#444] mr-2">Funnels</span>
        <div className="flex gap-1.5 flex-wrap">
          {FUNNELS.map(f => (
            <button
              key={f.key}
              onClick={() => toggleFunnel(f.key)}
              className={`px-3 py-1 text-[10px] uppercase tracking-widest rounded-full transition-all whitespace-nowrap ${
                activeFunnels.includes(f.key)
                  ? 'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 shadow-[0_0_8px_rgba(0,255,136,0.08)]'
                  : 'text-[#555] hover:text-[#888] hover:bg-[#1a1a2e]/50 border border-[#1a1a2e]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Active Filters Tags ═══ */}
      {activeFunnels.length > 1 && (
        <div className="border-b border-[#1a1a2e] bg-[#0b0b14] px-4 py-1.5 flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-[#444] mr-1">Active:</span>
          {activeFunnels.map(key => {
            const f = FUNNELS.find(fn => fn.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded text-[9px] text-[#00ff88]"
              >
                {f?.label}
                <button onClick={() => removeFunnel(key)} className="hover:text-white transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* ═══ Main Resizable Layout ═══ */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Center - Data Grid */}
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="h-full overflow-auto p-3 space-y-3">
              {activeFunnelConfigs.map(f => (
                <div key={f.key} className="flex flex-col" style={{ minHeight: activeFunnelConfigs.length > 1 ? '45%' : '100%' }}>
                  {activeFunnelConfigs.length > 1 && (
                    <div className="text-[9px] uppercase tracking-widest text-[#00ff88]/50 mb-1.5 px-1">
                      ▸ {f.label} <span className="text-[#333]">— {f.table}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <DevLeadTable
                      funnel={f}
                      userEmail={user.email || ''}
                      density={density}
                      onRowInspect={(row) => openDrawer(row, f.table, f.key)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Monitor / Audit */}
          <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
            <div className="h-full bg-[#0b0b14] flex flex-col border-l border-[#1a1a2e]">
              {/* Tab Headers */}
              <div className="flex border-b border-[#1a1a2e] shrink-0">
                <button
                  onClick={() => setRightPanelTab('monitor')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
                    rightPanelTab === 'monitor'
                      ? 'bg-[#1a1a2e] text-[#00ff88] border-b-2 border-[#00ff88]'
                      : 'text-[#555] hover:text-[#888]'
                  }`}
                >
                  <Activity className="w-3 h-3" /> SYS
                </button>
                <button
                  onClick={() => setRightPanelTab('audit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
                    rightPanelTab === 'audit'
                      ? 'bg-[#1a1a2e] text-[#00ff88] border-b-2 border-[#00ff88]'
                      : 'text-[#555] hover:text-[#888]'
                  }`}
                >
                  <Terminal className="w-3 h-3" /> LOG
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {rightPanelTab === 'monitor' ? <DevSystemMonitor /> : <DevAuditLog />}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ═══ Command Palette ═══ */}
      {cmdOpen && <DevCommandPalette onClose={() => setCmdOpen(false)} funnels={FUNNELS} />}

      {/* ═══ Row Drawer ═══ */}
      {drawerRow && (
        <DevRowDrawer
          row={drawerRow}
          table={drawerTable}
          funnelKey={drawerFunnelKey}
          userEmail={user.email || ''}
          onClose={() => setDrawerRow(null)}
          onSaved={() => setDrawerRow(null)}
        />
      )}
    </div>
  );
};

export default DeveloperPortal;
