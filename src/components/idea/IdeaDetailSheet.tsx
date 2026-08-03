/**
 * IdeaDetailSheet — the full, untruncated view of a submitted idea.
 * The table row clamps the description to two lines; this drawer never does.
 */
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ImageIcon } from 'lucide-react';
import { fieldStamp } from '@/lib/dates';
import type { IdeaSubmission } from '@/hooks/useIdeaBox';
import { IdeaAttachmentLightbox } from './IdeaAttachmentLightbox';

interface Props {
  idea: IdeaSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IdeaDetailSheet({ idea, open, onOpenChange }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  const attachments = idea?.attachments ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {idea && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="break-words [overflow-wrap:anywhere]">
                  {idea.title}
                </SheetTitle>
                <SheetDescription className="break-words">
                  {idea.submitter_name || idea.submitter_email || 'Unknown'}
                  {idea.submitter_role ? ` · ${idea.submitter_role}` : ''} ·{' '}
                  {fieldStamp(idea.created_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {idea.category.replace('_', ' ')}
                </Badge>
                <Badge
                  variant={
                    idea.priority === 'blocker' || idea.priority === 'high'
                      ? 'destructive'
                      : 'outline'
                  }
                  className="capitalize"
                >
                  {idea.priority}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {idea.status.replace('_', ' ')}
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                {/* Full text — never clamped, wraps long unbroken strings */}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {idea.body}
                </p>
              </div>

              {idea.route_path && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Captured on page
                    </p>
                    <p className="break-all font-mono text-xs">{idea.route_path}</p>
                    {idea.route_label && (
                      <p className="text-xs text-muted-foreground break-words">
                        {idea.route_label}
                      </p>
                    )}
                  </div>
                </>
              )}

              {attachments.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Photos ({attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((a, i) => (
                        <Button
                          key={a.path}
                          variant="outline"
                          size="sm"
                          className="max-w-full"
                          onClick={() => {
                            setStartIndex(i);
                            setLightboxOpen(true);
                          }}
                        >
                          <ImageIcon className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{a.name || `Photo ${i + 1}`}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(idea.user_agent || idea.viewport) && (
                <>
                  <Separator className="my-4" />
                  <p className="break-words text-[11px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {idea.viewport ? `${idea.viewport} · ` : ''}
                    {idea.user_agent}
                  </p>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <IdeaAttachmentLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        attachments={attachments}
        startIndex={startIndex}
        title={idea?.title}
      />
    </>
  );
}
