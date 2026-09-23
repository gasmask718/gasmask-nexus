/**
 * AmbassadorHelpMenu — ONE floating Help control for the Ambassador Portal.
 *
 * Consolidates what used to be several overlapping floating circles:
 *  - Ambassador training ("How do I...?")
 *  - Re-launch first-day tour
 *  - Submit an idea
 *  - Report a problem
 *
 * The underlying features are untouched; this only changes how they are reached.
 */
import { useState } from 'react';
import { HelpCircle, GraduationCap, Sparkles, Lightbulb, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';
import { IdeaSubmitDialog } from '@/components/idea/IdeaSubmitDialog';
import { TRAINING_OPEN_EVENT, TRAINING_FIRST_DAY_EVENT } from '@/components/training/TrainingHelp';

export function AmbassadorHelpMenu() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);

  const fire = (name: string) => window.dispatchEvent(new CustomEvent(name));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            aria-label="Help"
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-6 md:right-6"
          >
            <HelpCircle className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 bg-popover z-50">
          <DropdownMenuLabel>Help</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => fire(TRAINING_OPEN_EVENT)}>
            <GraduationCap className="h-4 w-4 mr-2" />
            Ambassador training
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fire(TRAINING_FIRST_DAY_EVENT)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Re-launch first-day tour
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIdeaOpen(true)}>
            <Lightbulb className="h-4 w-4 mr-2" />
            Submit an idea
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
            <MessageSquareWarning className="h-4 w-4 mr-2" />
            Report a problem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <IdeaSubmitDialog open={ideaOpen} onOpenChange={setIdeaOpen} />
    </>
  );
}

export default AmbassadorHelpMenu;
