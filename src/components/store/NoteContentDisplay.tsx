import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoteContentDisplayProps {
  content: string | null | undefined;
  className?: string;
  collapsedLines?: number;
  /** Render content as HTML (sanitized upstream) instead of plain text. */
  asHtml?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
}

const TRUNCATION_THRESHOLD = 200; // characters

const LINE_CLAMP: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

/**
 * Contained, expandable note renderer.
 * - min-w-0 allows shrinking inside flex/grid parents
 * - break-words + overflow-hidden prevent overflow from URLs / long tokens
 * - line-clamp-N collapses long content with a Show more / Show less toggle
 *
 * IMPORTANT: parent container should also have min-w-0 when inside flex/grid.
 */
export function NoteContentDisplay({
  content,
  className,
  collapsedLines = 3,
  asHtml = false,
  expandLabel = 'Show more',
  collapseLabel = 'Show less',
}: NoteContentDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  const isLong = content.length > TRUNCATION_THRESHOLD;
  const clampClass = LINE_CLAMP[collapsedLines] ?? LINE_CLAMP[3];

  const sharedClasses = cn(
    'min-w-0 max-w-full overflow-hidden break-words whitespace-pre-wrap text-sm',
    !expanded && isLong && clampClass,
    className,
  );

  return (
    <div className="min-w-0 max-w-full">
      {asHtml ? (
        <div
          className={cn(
            sharedClasses,
            '[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_*]:!max-w-full [&_*]:break-words',
          )}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className={sharedClasses}>{content}</div>
      )}

      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-xs text-primary hover:text-primary/80 mt-1 inline-flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {collapseLabel}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {expandLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}
