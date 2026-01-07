/**
 * CategoryKPIEditModal
 * Edit modal for Category KPI metadata (name, target, thresholds, visibility)
 * Does NOT modify KPI calculations, formulas, or aggregation logic
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface CategoryMetadata {
  value: string;
  label: string;
  targetPartners?: number;
  targetStates?: number;
  isVisible?: boolean;
}

interface CategoryKPIEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryMetadata | null;
  onSave: (updated: CategoryMetadata) => void;
}

export function CategoryKPIEditModal({
  open,
  onOpenChange,
  category,
  onSave,
}: CategoryKPIEditModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CategoryMetadata>({
    value: "",
    label: "",
    targetPartners: 10,
    targetStates: 5,
    isVisible: true,
  });

  // Reset form when category changes
  useEffect(() => {
    if (category) {
      setFormData({
        value: category.value,
        label: category.label,
        targetPartners: category.targetPartners ?? 10,
        targetStates: category.targetStates ?? 5,
        isVisible: category.isVisible ?? true,
      });
    }
  }, [category]);

  const handleCancel = () => {
    // Restore original state on cancel
    if (category) {
      setFormData({
        value: category.value,
        label: category.label,
        targetPartners: category.targetPartners ?? 10,
        targetStates: category.targetStates ?? 5,
        isVisible: category.isVisible ?? true,
      });
    }
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave(formData);
    toast({
      title: "Category updated",
      description: `${formData.label} settings have been saved.`,
    });
    onOpenChange(false);
  };

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Category Settings</DialogTitle>
          <DialogDescription>
            Modify display settings for {category.label}. This does not affect KPI calculations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Category display name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="targetPartners">Target Partners</Label>
            <Input
              id="targetPartners"
              type="number"
              min={0}
              value={formData.targetPartners}
              onChange={(e) =>
                setFormData({ ...formData, targetPartners: parseInt(e.target.value) || 0 })
              }
              placeholder="Target number of partners"
            />
            <p className="text-xs text-muted-foreground">
              Goal for number of partners in this category
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="targetStates">Target States Coverage</Label>
            <Input
              id="targetStates"
              type="number"
              min={0}
              max={50}
              value={formData.targetStates}
              onChange={(e) =>
                setFormData({ ...formData, targetStates: parseInt(e.target.value) || 0 })
              }
              placeholder="Target number of states"
            />
            <p className="text-xs text-muted-foreground">
              Goal for number of states covered
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="visibility">Visible on Dashboard</Label>
              <p className="text-xs text-muted-foreground">
                Show this category in the KPI grid
              </p>
            </div>
            <Switch
              id="visibility"
              checked={formData.isVisible}
              onCheckedChange={(checked) => setFormData({ ...formData, isVisible: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
