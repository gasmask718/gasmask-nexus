// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PANEL HEADER — Title, Summary, and Quick Stats
// ═══════════════════════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ResultsPanelHeaderProps {
  title: string;
  summary: string;
  totalCount: number;
  selectedCount: number;
  loading?: boolean;
  onRefresh: () => void;
  onClose?: () => void;
  showBackButton?: boolean;
}

export function ResultsPanelHeader({
  title,
  summary,
  totalCount,
  selectedCount,
  loading,
  onRefresh,
  onClose,
  showBackButton = true,
}: ResultsPanelHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {totalCount} results
          </Badge>
          
          {selectedCount > 0 && (
            <Badge variant="default" className="bg-primary">
              {selectedCount} selected
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResultsPanelHeader;
