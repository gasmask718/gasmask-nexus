import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Copy, Eye } from "lucide-react";
import { useState } from "react";
import { TemplatePreview } from "./TemplatePreview";

interface TemplateListProps {
  templates: any[];
  onEdit: (template: any) => void;
  allowedBrands: string[];
}

export function TemplateList({ templates, onEdit, allowedBrands }: TemplateListProps) {
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const filteredTemplates = templates.filter(t => 
    allowedBrands.includes(t.brand)
  );

  const getBrandColor = (brand: string) => {
    const colors: Record<string, string> = {
      GasMask: "bg-slate-500",
      HotMama: "bg-pink-500",
      GrabbaRUs: "bg-blue-500",
      HotScalati: "bg-red-500",
      TopTier: "bg-purple-500",
      UnforgettableTimes: "bg-yellow-500",
      iCleanWeClean: "bg-green-500",
      Playboxxx: "bg-violet-500",
      Funding: "bg-emerald-500",
      Grants: "bg-teal-500",
      CreditRepair: "bg-cyan-500",
      SpecialNeeds: "bg-indigo-500",
      SportsBetting: "bg-orange-500",
      Dynasty: "bg-gold-500",
    };
    return colors[brand] || "bg-gray-500";
  };

  const getCategoryLabel = (category: string) => {
    return category
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (filteredTemplates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No templates found. Create your first template to get started.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{template.name}</h3>
                <div className="flex gap-2">
                  <Badge className={getBrandColor(template.brand)}>
                    {template.brand}
                  </Badge>
                  <Badge variant="outline">
                    {getCategoryLabel(template.category)}
                  </Badge>
                </div>
              </div>
              {!template.is_active && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>

            {template.subject && (
              <p className="text-sm text-muted-foreground">
                Subject: {template.subject}
              </p>
            )}

            <p className="text-sm line-clamp-2">{template.content}</p>

            {template.variables && template.variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.variables.map((v: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {`{${v}}`}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewTemplate(template)}
              >
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(template)}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(template.content);
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </>
  );
}
