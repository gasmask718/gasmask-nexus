import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IdeaSubmitDialog } from './IdeaSubmitDialog';
import { useAuth } from '@/contexts/AuthContext';

/** App-wide floating "Submit Idea" launcher. Visible to every signed-in role. */
export function IdeaBoxLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            aria-label="Submit an idea or improvement"
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg md:bottom-6"
          >
            <Lightbulb className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Submit an idea</TooltipContent>
      </Tooltip>
      <IdeaSubmitDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
