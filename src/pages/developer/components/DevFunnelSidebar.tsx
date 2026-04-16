import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';

export interface FunnelConfig {
  key: string;
  label: string;
  table: string;
}

export interface FunnelGroup {
  key: string;
  label: string;
  icon: string;
  funnels: FunnelConfig[];
}

interface Props {
  groups: FunnelGroup[];
  activeFunnels: string[];
  onToggle: (key: string) => void;
  onSolo: (key: string) => void;
  onClearAll: () => void;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}

export const DevFunnelSidebar = ({
  groups,
  activeFunnels,
  onToggle,
  onSolo,
  onClearAll,
  collapsed,
  onCollapsedChange,
}: Props) => {
  const [expanded, setExpanded] = useState<string[]>(groups.map(g => g.key));
  const [filter, setFilter] = useState('');

  const toggleGroup = (key: string) =>
    setExpanded(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const filtered = groups
    .map(g => ({
      ...g,
      funnels: g.funnels.filter(
        f =>
          !filter ||
          f.label.toLowerCase().includes(filter.toLowerCase()) ||
          f.table.toLowerCase().includes(filter.toLowerCase())
      ),
    }))
    .filter(g => g.funnels.length > 0);

  if (collapsed) {
    return (
      <div className="h-full bg-[#0b0b14] border-r border-[#1a1a2e] w-10 flex flex-col items-center py-3 gap-2 shrink-0">
        <button
          onClick={() => onCollapsedChange(false)}
          className="text-[#555] hover:text-[#00ff88] transition-colors p-1"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="text-[8px] text-[#444] uppercase tracking-widest writing-mode-vertical mt-2"
          style={{ writingMode: 'vertical-rl' }}>
          Funnels · {activeFunnels.length}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0b0b14] border-r border-[#1a1a2e] w-56 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1a1a2e] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#00ff88]">Funnels</span>
          <span className="text-[9px] text-[#444]">({activeFunnels.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {activeFunnels.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[8px] uppercase tracking-widest text-[#555] hover:text-red-400 transition-colors"
              title="Clear all"
            >
              clear
            </button>
          )}
          <button
            onClick={() => onCollapsedChange(true)}
            className="text-[#555] hover:text-[#888] transition-colors p-0.5"
            title="Collapse"
          >
            <ChevronRight className="w-3 h-3 rotate-180" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-[#1a1a2e] shrink-0">
        <div className="flex items-center gap-1.5 bg-[#0a0a0f] border border-[#1a1a2e] rounded px-2 py-1">
          <Search className="w-3 h-3 text-[#444]" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter…"
            className="bg-transparent text-[10px] text-[#c8c8d0] placeholder:text-[#333] focus:outline-none flex-1 font-mono"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="text-[#444] hover:text-[#888]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-auto">
        {filtered.map(group => {
          const isOpen = expanded.includes(group.key);
          const groupActiveCount = group.funnels.filter(f => activeFunnels.includes(f.key)).length;

          return (
            <div key={group.key} className="border-b border-[#11111c]">
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#11111c] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3 text-[#555]" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[#555]" />
                  )}
                  <span className="text-[10px]">{group.icon}</span>
                  <span className="text-[10px] uppercase tracking-widest text-[#888] group-hover:text-[#c8c8d0]">
                    {group.label}
                  </span>
                </div>
                {groupActiveCount > 0 && (
                  <span className="text-[8px] text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/20 rounded px-1.5 py-0.5">
                    {groupActiveCount}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="pb-1">
                  {group.funnels.map(f => {
                    const active = activeFunnels.includes(f.key);
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center group transition-colors ${
                          active ? 'bg-[#00ff88]/5' : 'hover:bg-[#11111c]'
                        }`}
                      >
                        <button
                          onClick={() => onToggle(f.key)}
                          className="flex-1 flex items-center gap-2 px-3 py-1.5 pl-8 text-left min-w-0"
                        >
                          <span
                            className={`w-1 h-1 rounded-full shrink-0 ${
                              active ? 'bg-[#00ff88] shadow-[0_0_4px_#00ff88]' : 'bg-[#333]'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-[10px] truncate ${
                                active ? 'text-[#00ff88]' : 'text-[#888] group-hover:text-[#c8c8d0]'
                              }`}
                            >
                              {f.label}
                            </div>
                            <div className="text-[8px] text-[#333] truncate font-mono">{f.table}</div>
                          </div>
                        </button>
                        <button
                          onClick={() => onSolo(f.key)}
                          className="opacity-0 group-hover:opacity-100 text-[8px] uppercase tracking-widest text-[#444] hover:text-[#00ff88] px-2 py-1 transition-all"
                          title="Solo (show only this)"
                        >
                          solo
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[10px] text-[#444] py-8 px-3">
            No funnels match "{filter}"
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-[#1a1a2e] shrink-0">
        <div className="text-[8px] text-[#333] uppercase tracking-widest leading-relaxed">
          Click to toggle · Hover for solo
        </div>
      </div>
    </div>
  );
};
