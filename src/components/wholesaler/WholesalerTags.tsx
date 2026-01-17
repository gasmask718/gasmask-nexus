import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GlobalTagSelector } from '@/components/tags/GlobalTagSelector';
import { useEntityTags } from '@/hooks/useGlobalTags';
import { Tag } from 'lucide-react';

// Predefined wholesaler tags with colors
export const WHOLESALER_TAG_PRESETS = [
  { name: 'High Volume', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { name: 'Price Sensitive', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { name: 'Net-30 Trusted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { name: 'At Risk', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { name: 'Strategic Partner', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { name: 'New Relationship', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { name: 'Dormant', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  { name: 'VIP', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { name: 'Regional Lead', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { name: 'Exclusive Territory', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
];

export const getTagColor = (tagName: string): string => {
  const preset = WHOLESALER_TAG_PRESETS.find(
    t => t.name.toLowerCase() === tagName.toLowerCase()
  );
  return preset?.color || 'bg-muted text-muted-foreground';
};

interface WholesalerTagsProps {
  wholesalerId: string;
  compact?: boolean;
  showSelector?: boolean;
  className?: string;
}

export function WholesalerTags({
  wholesalerId,
  compact = false,
  showSelector = true,
  className = '',
}: WholesalerTagsProps) {
  const { data: entityTags = [], isLoading } = useEntityTags('wholesaler', wholesalerId);

  const tags = entityTags.map(et => et.global_tags).filter(Boolean);

  if (isLoading && tags.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Display current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag?.id}
              variant="outline"
              className={`${getTagColor(tag?.name || '')} ${compact ? 'text-xs py-0' : ''}`}
            >
              {!compact && <Tag className="h-3 w-3 mr-1" />}
              {tag?.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Tag selector */}
      {showSelector && (
        <GlobalTagSelector
          entityType="wholesaler"
          entityId={wholesalerId}
          category="wholesaler"
          placeholder="Add or manage tags..."
        />
      )}

      {/* Empty state */}
      {!showSelector && tags.length === 0 && (
        <p className="text-xs text-muted-foreground">No tags assigned</p>
      )}
    </div>
  );
}

// Inline display version for headers/cards
export function WholesalerTagsBadges({
  wholesalerId,
  maxTags = 3,
}: {
  wholesalerId: string;
  maxTags?: number;
}) {
  const { data: entityTags = [] } = useEntityTags('wholesaler', wholesalerId);
  const tags = entityTags.map(et => et.global_tags).filter(Boolean);

  if (tags.length === 0) return null;

  const displayTags = tags.slice(0, maxTags);
  const remaining = tags.length - maxTags;

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map(tag => (
        <Badge
          key={tag?.id}
          variant="outline"
          className={`${getTagColor(tag?.name || '')} text-xs py-0`}
        >
          {tag?.name}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs py-0 bg-muted/50">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
