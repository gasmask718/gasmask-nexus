import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { FileText } from "lucide-react";

interface TemplateSelectorProps {
  category?: string;
  onSelect: (template: string) => void;
}

export const TemplateSelector = ({ category, onSelect }: TemplateSelectorProps) => {
  const { data: templates } = useQuery({
    queryKey: ['communication-templates', category],
    queryFn: async () => {
      let query = supabase
        .from('communication_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (!templates || templates.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="gap-2">
          <FileText className="h-4 w-4" />
          Use Template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search templates..." />
          <CommandEmpty>No templates found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {templates.map((template) => (
              <CommandItem
                key={template.id}
                onSelect={async () => {
                  onSelect(template.message_template);
                  // Track usage
                  await supabase
                    .from('communication_templates')
                    .update({
                      usage_count: (template.usage_count || 0) + 1,
                      last_used_at: new Date().toISOString(),
                    })
                    .eq('id', template.id);
                }}
                className="flex flex-col items-start gap-1 p-3"
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {template.message_template}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};