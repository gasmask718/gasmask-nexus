// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA COMMAND CONSOLE PAGE — Natural Language Task Engine
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
