/**
 * IdeaAttachmentLightbox — views private idea attachments IN PLACE.
 *
 * The `idea-attachments` bucket is private, so an unsigned public URL 302s to
 * an auth page — which is why clicking a photo used to navigate away from
 * /ideas. Signed URLs are minted FRESH when the lightbox opens (never at
 * render time), so a link can't be expired by the time it is used.
 */
import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react';
import { getIdeaAttachmentUrl, type IdeaAttachment } from '@/hooks/useIdeaBox';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: IdeaAttachment[];
  startIndex?: number;
  title?: string;
}

export function IdeaAttachmentLightbox({
  open,
  onOpenChange,
  attachments,
  startIndex = 0,
  title,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  // Fresh signed URL on every open / navigation.
  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    const current = attachments[index];
    if (!current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);
    getIdeaAttachmentUrl(current.path)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load photo');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, index, attachments]);

  const count = attachments.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);

  // Basic touch swipe for phones.
  const [touchX, setTouchX] = useState<number | null>(null);

  const current = attachments[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-3 sm:p-4">
        <DialogTitle className="pr-8 text-sm font-medium break-words">
          {title ? `${title} — ` : ''}
          {current?.name || 'Photo'}
          {count > 1 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {index + 1} / {count}
            </span>
          )}
        </DialogTitle>

        <div
          className="relative flex min-h-[240px] items-center justify-center rounded-md bg-muted/40"
          onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          {loading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {error && <p className="p-6 text-sm text-destructive break-words">{error}</p>}
          {!loading && !error && url && (
            <img
              src={url}
              alt={current?.name || 'Idea attachment'}
              className="max-h-[70vh] w-auto max-w-full rounded-md object-contain"
            />
          )}

          {count > 1 && (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={() => go(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Next photo"
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                onClick={() => go(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {url && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" asChild>
              <a href={url} download={current?.name} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
