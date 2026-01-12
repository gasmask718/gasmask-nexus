import { useState } from 'react';
import { Calendar, Edit2, X, Check, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemberSince } from '@/hooks/useMemberSince';

interface MemberSinceDisplayProps {
  storeId: string;
  className?: string;
}

export function MemberSinceDisplay({ storeId, className }: MemberSinceDisplayProps) {
  const { data, isLoading, updateMemberSince, clearManualOverride, isUpdating } = useMemberSince(storeId);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = () => {
    setEditValue(data?.date || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue) {
      await updateMemberSince(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleClearOverride = async () => {
    await clearManualOverride();
  };

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-sm text-muted-foreground">Member Since</p>
        <div className="h-5 w-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const displayDate = data?.date 
    ? new Date(data.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Unknown';

  const sourceLabel = data?.source === 'manual' 
    ? 'Manually set' 
    : data?.source === 'note' 
    ? 'From earliest note' 
    : 'From store creation';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Member Since</p>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={handleStartEdit}
                    disabled={isUpdating}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit member since date</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {data?.isManual && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={handleClearOverride}
                      disabled={isUpdating}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Revert to auto-calculated date</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
            disabled={isUpdating}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleSave}
            disabled={isUpdating}
          >
            <Check className="h-4 w-4 text-green-500" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleCancel}
            disabled={isUpdating}
          >
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{displayDate}</span>
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0 ${
              data?.isManual 
                ? 'border-blue-500/30 text-blue-600' 
                : 'border-muted-foreground/30 text-muted-foreground'
            }`}
          >
            {sourceLabel}
          </Badge>
        </div>
      )}
    </div>
  );
}
