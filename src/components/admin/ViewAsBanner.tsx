/**
 * ViewAsBanner - Shows when admin is viewing portal as another ambassador
 * Fixed banner at top of page with exit button
 */
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewAs } from '@/contexts/ViewAsContext';

export function ViewAsBanner() {
  const { isViewingAs, viewAsAmbassador, stopViewAs } = useViewAs();

  if (!isViewingAs || !viewAsAmbassador) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="font-medium">
            Viewing as {viewAsAmbassador.name || 'Ambassador'}
          </span>
          <span className="text-amber-800 text-sm">(Admin Mode - Read Only)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopViewAs}
          className="text-amber-950 hover:bg-amber-600 hover:text-amber-950"
        >
          <X className="h-4 w-4 mr-1" />
          Exit View As
        </Button>
      </div>
    </div>
  );
}

export default ViewAsBanner;
