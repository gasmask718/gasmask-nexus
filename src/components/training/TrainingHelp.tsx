import { useEffect, useState } from 'react';
import { HelpCircle, ChevronLeft, ChevronRight, Check, PlayCircle, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  useTrainingModules,
  useTrainingProgress,
  useUpdateProgress,
  type TrainingModule,
  type TrainingRole,
} from './useTrainingData';

interface Props {
  role: TrainingRole;
  /** First-day tour title to show in the welcome dialog (e.g. "Driver Portal Tour") */
  firstDayTitle?: string;
  /** Extra className for the floating button position */
  className?: string;
}

/**
 * TrainingHelp — drop once per portal.
 * Renders the floating ❓ button + role-filtered SOP drawer + first-day welcome.
 */
export function TrainingHelp({ role, firstDayTitle, className }: Props) {
  const { data: modules = [], isLoading } = useTrainingModules(role);
  const { data: progress } = useTrainingProgress();
  const updateProgress = useUpdateProgress();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [firstDayOpen, setFirstDayOpen] = useState(false);

  // Auto-trigger first-day prompt when user has no progress row & we have modules.
  useEffect(() => {
    if (isLoading) return;
    if (!progress || !progress.first_day_dismissed_at) {
      if (modules.length > 0) setFirstDayOpen(true);
    }
  }, [progress, isLoading, modules.length]);

  const startFirstDay = () => {
    setFirstDayOpen(false);
    updateProgress.mutate({
      role,
      first_day_started_at: new Date().toISOString(),
    });
    const first = modules.find((m) => m.is_first_day) ?? modules[0];
    if (first) {
      setActiveId(first.id);
      setOpen(true);
    }
  };

  const dismissFirstDay = () => {
    setFirstDayOpen(false);
    updateProgress.mutate({
      role,
      first_day_dismissed_at: new Date().toISOString(),
    });
  };

  const active = modules.find((m) => m.id === activeId) ?? null;
  const completedIds = progress?.completed_module_ids ?? [];
  const activeIdx = active ? modules.findIndex((m) => m.id === active.id) : -1;

  const markComplete = (mod: TrainingModule) => {
    if (completedIds.includes(mod.id)) return;
    updateProgress.mutate({
      role,
      completed_module_ids: [...completedIds, mod.id],
      last_module_id: mod.id,
    });
  };

  const goto = (idx: number) => {
    const next = modules[idx];
    if (next) setActiveId(next.id);
  };

  return (
    <>
      {/* Floating ❓ button */}
      <Button
        size="icon"
        variant="default"
        onClick={() => setOpen(true)}
        aria-label="How do I..."
        className={cn(
          'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition',
          className,
        )}
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              How do I...?
            </SheetTitle>
            <SheetDescription>
              {role.charAt(0).toUpperCase() + role.slice(1)} training — {modules.length}{' '}
              step{modules.length === 1 ? '' : 's'}.
            </SheetDescription>
          </SheetHeader>

          {!active ? (
            <div className="flex-1 overflow-auto p-6 space-y-2">
              {isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {!isLoading && modules.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No training modules yet for this role.
                </p>
              )}
              {modules.map((m, i) => {
                const done = completedIds.includes(m.id);
                return (
                  <Card
                    key={m.id}
                    className="p-4 cursor-pointer hover:bg-accent transition flex items-center gap-3"
                    onClick={() => setActiveId(m.id)}
                  >
                    <div
                      className={cn(
                        'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold',
                        done
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.title}</div>
                      <div className="flex gap-1 mt-1">
                        {m.is_first_day && (
                          <Badge variant="secondary" className="text-[10px]">
                            First-day
                          </Badge>
                        )}
                        {m.video_url && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <PlayCircle className="h-3 w-3" /> Video
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {progress?.first_day_dismissed_at && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setFirstDayOpen(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Re-launch first-day tour
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-3 border-b flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveId(null)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> All steps
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  Step {activeIdx + 1} of {modules.length}
                </span>
              </div>

              <div className="flex-1 overflow-auto px-6 py-4">
                <h2 className="text-xl font-semibold mb-3">{active.title}</h2>
                {active.video_url && (
                  <div className="aspect-video mb-4 rounded-md overflow-hidden bg-muted">
                    <iframe
                      src={active.video_url}
                      title={active.title}
                      className="w-full h-full"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
                      allowFullScreen
                    />
                  </div>
                )}
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{active.content_md}</ReactMarkdown>
                </article>
                {active.screenshots?.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {active.screenshots.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`${active.title} screenshot ${i + 1}`}
                        className="rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 border-t flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={activeIdx <= 0}
                  onClick={() => goto(activeIdx - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button
                  size="sm"
                  variant={completedIds.includes(active.id) ? 'secondary' : 'default'}
                  onClick={() => markComplete(active)}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {completedIds.includes(active.id) ? 'Completed' : 'Mark complete'}
                </Button>
                <Button
                  size="sm"
                  disabled={activeIdx >= modules.length - 1}
                  onClick={() => goto(activeIdx + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* First-day welcome */}
      <Dialog open={firstDayOpen} onOpenChange={setFirstDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Welcome — let's walk through your day
            </DialogTitle>
            <DialogDescription>
              {firstDayTitle ??
                `We'll show you the core ${role} flow once. You can re-launch it anytime from the ❓ button.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={dismissFirstDay}>
              <X className="h-4 w-4 mr-1" /> Skip
            </Button>
            <Button onClick={startFirstDay}>
              <PlayCircle className="h-4 w-4 mr-1" /> Start tour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TrainingHelp;
