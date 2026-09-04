/**
 * VACompanySwitcher — header picker for "who am I calling for".
 *
 * Renders only when the VA can reach more than one company (multi-membership
 * or Dynasty Connect switchboard). Switching re-scopes caller ID, leads and
 * scripts via VACompanyContext.
 */
import { useVACompany } from '@/contexts/VACompanyContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export function VACompanySwitcher() {
  const { companies, activeCompany, setActiveCompany, isSwitchboard } = useVACompany();

  if (companies.length <= 1) return null;

  return (
    <Select value={activeCompany?.id ?? ''} onValueChange={setActiveCompany}>
      <SelectTrigger className="h-8 w-[190px] bg-caller/10 border-caller/30 text-caller text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="h-3 w-3 shrink-0" />
          <SelectValue placeholder="Calling for…" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700 text-white">
        {isSwitchboard && (
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-700/60 mb-1">
            Dynasty Connect switchboard
          </div>
        )}
        {companies.map((c) => (
          <SelectItem
            key={c.id}
            value={c.id}
            className="focus:bg-caller/10 focus:text-caller"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: c.brand_color ?? '#22d3ee' }}
              />
              <span className="text-xs font-medium truncate">{c.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
