/**
 * SIMULATION WATERMARK — PAGE-LEVEL VISUAL INDICATOR
 * 
 * 🧠👑 MASTER GENIUS PROMPT IMPLEMENTATION
 * 
 * Displays a subtle but visible watermark on pages when in simulation mode.
 * This ensures users NEVER forget they're working with demo data.
 */

import { useSimulationMode } from '@/contexts/SimulationModeContext';

interface SimulationWatermarkProps {
  className?: string;
}

export function SimulationWatermark({ className = '' }: SimulationWatermarkProps) {
  const { simulationMode, isLoading } = useSimulationMode();

  // Don't show if not in simulation mode or still loading
  if (isLoading || !simulationMode) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 pointer-events-none z-[5] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Diagonal repeating watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="text-amber-500/[0.04] dark:text-amber-500/[0.06] font-black text-[120px] sm:text-[180px] tracking-[0.2em] whitespace-nowrap select-none rotate-[-35deg] scale-150"
          style={{ 
            textShadow: 'none',
            WebkitTextStroke: '1px rgba(245, 158, 11, 0.03)'
          }}
        >
          SIMULATION
        </div>
      </div>
      
      {/* Corner indicator */}
      <div className="absolute bottom-4 right-4 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/20">
        DEMO MODE
      </div>
    </div>
  );
}

/**
 * Full-page overlay version for critical areas
 */
export function SimulationOverlay({ children }: { children: React.ReactNode }) {
  const { simulationMode, isLoading } = useSimulationMode();

  if (isLoading || !simulationMode) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children}
      <SimulationWatermark />
    </div>
  );
}

export default SimulationWatermark;
