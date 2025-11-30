// src/components/system/SystemCheckpointBar.tsx
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSystemCheckpoints } from '@/hooks/useSystemCheckpoints';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  HardDriveDownload,
  RefreshCw,
  Clock,
  Shield,
  History,
} from 'lucide-react';

const ADMIN_PATH_PREFIXES = ['/os', '/dynasty', '/finance', '/system', '/grabba', '/'];

export default function SystemCheckpointBar() {
  const { role, isAdmin } = useUserRole();
  const location = useLocation();
  const [showDetails, setShowDetails] = useState(false);

  const {
    checkpoints,
    latestCheckpoint,
    lastAutoSaveAt,
    saveManualCheckpoint,
    triggerAutoCheckpoint,
    restoreLast,
  } = useSystemCheckpoints(10); // auto-save every 10 minutes

  // Only show for admins
  if (!isAdmin || role !== 'admin') return null;

  // Hide on auth pages
  const path = location.pathname;
  if (path.startsWith('/login') || path.startsWith('/register')) return null;

  const lastTime =
    lastAutoSaveAt ||
    latestCheckpoint?.createdAt ||
    null;

  const formattedTime = lastTime
    ? new Date(lastTime).toLocaleTimeString()
    : 'No checkpoints yet';

  const handleManualSave = () => {
    const label = prompt('Checkpoint label?', 'Before major changes');
    saveManualCheckpoint(label || 'Manual Checkpoint');
  };

  const handleReset = () => {
    const ok = confirm(
      'Restore from the most recent checkpoint?\n\nNote: This will NOT rewrite code, but it will load your last saved diagnostics so you (or your dev) can recover navigation & module structure if anything is broken.'
    );
    if (!ok) return;

    const snapshot = restoreLast();
    if (!snapshot) {
      alert('No checkpoint found to restore.');
      return;
    }

    console.log('🧬 Loaded checkpoint diagnostics for review:', snapshot);
    alert(
      `Checkpoint "${snapshot.label}" loaded in console. Share this JSON with your dev / future self as the blueprint if something gets corrupted.`
    );
  };

  return (
    <div
      className={cn(
        'w-full border-b border-amber-500/20 bg-amber-950/40',
        'backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-3',
        'text-xs text-amber-100 z-40'
      )}
    >
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-amber-300" />
        <span className="font-medium">
          Dynasty OS Auto-Saver
        </span>
        <span className="hidden sm:inline text-amber-200/80">
          Checkpoints keep your OS structure safe if routing / navigation is ever damaged.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1 text-amber-200/80">
          <Clock className="h-3 w-3" />
          <span>Last checkpoint:</span>
          <span className="font-mono">{formattedTime}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs border-amber-400/40 text-amber-100 hover:bg-amber-500/10"
          onClick={handleManualSave}
        >
          <HardDriveDownload className="h-3 w-3 mr-1" />
          Save Checkpoint
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs border-amber-400/40 text-amber-100 hover:bg-amber-500/10"
          onClick={triggerAutoCheckpoint}
        >
          <History className="h-3 w-3 mr-1" />
          Quick Save
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs border-red-400/40 text-red-100 hover:bg-red-500/10"
          onClick={handleReset}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reset / Restore
        </Button>

        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="text-amber-200/70 hover:text-amber-100 ml-1"
          title="View checkpoint count"
        >
          <span className="font-mono text-[10px] flex items-center gap-1">
            <span>{checkpoints.length}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
