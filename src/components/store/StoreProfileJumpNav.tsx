// Quick jump bar for the customer profile. Anchors only — it never
// duplicates a section, it scrolls to the canonical one below.
import { Button } from '@/components/ui/button';
import { Gift, MessageSquare, StickyNote, Users } from 'lucide-react';

const TARGETS = [
  { id: 'samples', label: 'Samples', Icon: Gift },
  { id: 'messages-calls', label: 'Messages & Calls', Icon: MessageSquare },
  { id: 'notes-activity', label: 'Notes', Icon: StickyNote },
  { id: 'contacts', label: 'Contacts', Icon: Users },
];

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Land on the actual form, not just near it. When the note composer is
  // collapsed behind its "Add Note" button, open it first — this reuses the
  // existing form, it never creates a second one.
  window.setTimeout(() => {
    const field = () =>
      el.querySelector<HTMLElement>('textarea, input:not([type="hidden"])');
    if (!field()) {
      const opener = Array.from(el.querySelectorAll('button')).find((b) =>
        /add note/i.test(b.textContent || ''),
      );
      opener?.click();
    }
    window.setTimeout(() => {
      const target = field() ?? el.querySelector<HTMLElement>('button');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  }, 500);
}


export function StoreProfileJumpNav() {
  return (
    <nav
      aria-label="Jump to profile section"
      className="sticky top-0 z-20 -mx-1 flex gap-2 overflow-x-auto rounded-md border border-border/60 bg-background/95 px-1 py-2 backdrop-blur"
    >
      {TARGETS.map(({ id, label, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={() => jumpTo(id)}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </nav>
  );
}
