import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TemplatePreviewProps {
  template: any;
  onClose: () => void;
}

export function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  const { toast } = useToast();
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const renderContent = () => {
    let content = template.content;
    Object.entries(variableValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{${key}\\}`, "g"), value || `{${key}}`);
    });
    return content;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(renderContent());
    toast({
      title: "Copied",
      description: "Template content copied to clipboard",
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Template Preview
            <Badge>{template.brand}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {template.subject && (
            <div>
              <Label className="text-sm font-semibold">Subject:</Label>
              <p className="text-sm">{template.subject}</p>
            </div>
          )}

          {template.variables && template.variables.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Fill in variables:</Label>
              {template.variables.map((variable: string) => (
                <div key={variable} className="space-y-1">
                  <Label className="text-xs">{variable}</Label>
                  <Input
                    placeholder={`Enter ${variable}`}
                    value={variableValues[variable] || ""}
                    onChange={(e) =>
                      setVariableValues({
                        ...variableValues,
                        [variable]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Preview:</Label>
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
              {renderContent()}
            </div>
          </div>

          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
