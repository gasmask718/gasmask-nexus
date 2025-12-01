// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA COMMAND CONSOLE PAGE — Structured Query Engine (shortcuts, filters)
// ═══════════════════════════════════════════════════════════════════════════════

import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { CommandConsole } from '@/components/command';

export default function GrabbaCommandConsole() {
  return (
    <GrabbaLayout>
      <CommandConsole />
    </GrabbaLayout>
  );
}
