import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TemplateEditorProps {
  template: any;
  templateType: string;
  onClose: () => void;
}

const BRANDS = [
  "GasMask", "HotMama", "GrabbaRUs", "HotScalati", "TopTier",
  "UnforgettableTimes", "iCleanWeClean", "Playboxxx", "Funding",
  "Grants", "CreditRepair", "SpecialNeeds", "SportsBetting", "Dynasty"
];

const CATEGORIES: Record<string, string[]> = {
  sms: ["reorder_reminder", "thank_you", "delivery_confirmation", "upsell", "late_payment", "promotion", "cold_outreach", "wholesale_invitation", "ambassador_recruitment", "multi_brand_announcement"],
  email: ["welcome_sequence", "invoice", "receipt", "onboarding", "follow_up", "account_update", "contract_renewal", "abandoned_cart", "grant_request"],
  call_script: ["store_reorder_call", "wholesale_warm_call", "new_store_onboarding", "collection_reminder", "funding_intake", "credit_repair_update", "chauffeur_confirmation", "model_verification"],
  tone_pack: []
};

export function TemplateEditor({ template, templateType, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    brand: template?.brand || "",
    category: template?.category || "",
    name: template?.name || "",
    subject: template?.subject || "",
    content: template?.content || "",
    variables: template?.variables || [],
    is_active: template?.is_active ?? true,
  });
  const [newVariable, setNewVariable] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.brand || !formData.category || !formData.name || !formData.content) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        brand: formData.brand,
        template_type: templateType,
        category: formData.category,
        name: formData.name,
        subject: formData.subject || null,
        content: formData.content,
        variables: formData.variables,
        is_active: formData.is_active,
      };

      if (template?.id) {
        const { error } = await supabase
          .from("communication_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("communication_templates")
          .insert([payload]);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Template ${template?.id ? 'updated' : 'created'} successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["communication-templates"] });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    if (newVariable && !formData.variables.includes(newVariable)) {
      setFormData({
        ...formData,
        variables: [...formData.variables, newVariable],
      });
      setNewVariable("");
    }
  };

  const removeVariable = (variable: string) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((v: string) => v !== variable),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template?.id ? "Edit Template" : "Create New Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Brand *</Label>
              <Select value={formData.brand} onValueChange={(v) => setFormData({ ...formData, brand: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES[templateType]?.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Friendly Reorder Reminder"
            />
          </div>

          {templateType === "email" && (
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Template content. Use {variable_name} for dynamic values."
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Variables</Label>
            <div className="flex gap-2">
              <Input
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                placeholder="store_name, order_count, etc."
                onKeyDown={(e) => e.key === "Enter" && addVariable()}
              />
              <Button onClick={addVariable} variant="outline">Add</Button>
            </div>
            {formData.variables.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {formData.variables.map((v: string) => (
                  <Badge key={v} variant="secondary">
                    {`{${v}}`}
                    <X
                      className="w-3 h-3 ml-1 cursor-pointer"
                      onClick={() => removeVariable(v)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label>Active</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
