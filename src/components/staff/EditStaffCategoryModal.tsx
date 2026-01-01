import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertTriangle } from 'lucide-react';
import { StaffCategory, useUpdateStaffCategory, useCheckDuplicateCategoryName } from '@/hooks/useUnforgettableStaff';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

interface EditStaffCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: StaffCategory | null;
  onDelete?: (category: StaffCategory) => void;
}

/**
 * Edit Staff Category Modal
 * 
 * Editing a category must never reset performance history.
 * Identity persists; labels evolve.
 */
export function EditStaffCategoryModal({
  open,
  onOpenChange,
  category,
  onDelete,
}: EditStaffCategoryModalProps) {
  const { simulationMode } = useSimulationMode();
  const updateCategory = useUpdateStaffCategory();
  const checkDuplicate = useCheckDuplicateCategoryName();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || '');
      setIsActive(category.is_active);
      setNameError(null);
    }
  }, [category]);

  const validateName = async () => {
    if (!name.trim()) {
      setNameError('Category name is required');
      return false;
    }

    setIsCheckingDuplicate(true);
    try {
      const isDuplicate = await checkDuplicate(name.trim(), category?.id);
      if (isDuplicate) {
        setNameError('A category with this name already exists');
        return false;
      }
    } finally {
      setIsCheckingDuplicate(false);
    }

    setNameError(null);
    return true;
  };

  const handleSave = async () => {
    if (!category) return;

    const isValid = await validateName();
    if (!isValid) return;

    try {
      await updateCategory.mutateAsync({
        id: category.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
        },
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteClick = () => {
    if (category && onDelete) {
      onOpenChange(false);
      onDelete(category);
    }
  };

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Staff Category</DialogTitle>
          <DialogDescription>
            Update category details. KPI history will be preserved.
            {simulationMode && (
              <span className="text-amber-500 ml-1">(Simulation Mode)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="edit-cat-name">Category Name *</Label>
            <Input
              id="edit-cat-name"
              placeholder="e.g., Face Painter"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              onBlur={validateName}
              className={nameError ? 'border-destructive' : ''}
            />
            {nameError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {nameError}
              </p>
            )}
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="edit-cat-desc">Description</Label>
            <Input
              id="edit-cat-desc"
              placeholder="Brief description of this role"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="edit-cat-active">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Inactive categories won't appear in assignment dropdowns
              </p>
            </div>
            <Switch
              id="edit-cat-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Locked fields info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Protected Fields</p>
            <p>ID, Business, and Created Date cannot be modified.</p>
          </div>

          {/* Danger Zone */}
          {onDelete && (
            <div className="border-t pt-4 mt-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive mb-2">Danger Zone</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Archiving this category will preserve history but remove it from active use.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteClick}
                >
                  Archive Category
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateCategory.isPending || isCheckingDuplicate || !name.trim()}
          >
            {updateCategory.isPending || isCheckingDuplicate ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
