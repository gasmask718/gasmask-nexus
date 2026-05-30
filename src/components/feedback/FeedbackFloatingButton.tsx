/**
 * FeedbackFloatingButton — Small fixed-corner button rendered on every
 * ambassador portal page so the user can report a problem from wherever
 * they hit it. Opens FeedbackDialog (auto-captures current route).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquareWarning } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';

export function FeedbackFloatingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 shadow-lg rounded-full h-12 w-12 p-0 sm:h-auto sm:w-auto sm:px-4 sm:rounded-md"
        aria-label="Report a problem"
      >
        <MessageSquareWarning className="h-5 w-5 sm:mr-2" />
        <span className="hidden sm:inline">Report</span>
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export default FeedbackFloatingButton;
