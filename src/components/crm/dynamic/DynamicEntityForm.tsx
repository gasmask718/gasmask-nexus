import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  getCRMCategoryConfig, 
  getCategoryEntity,
  CRMCategorySlug, 
  EntityType,
  CRMField,
  CRMSection 
} from '@/config/crmCategories';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';

interface DynamicEntityFormProps {
  categorySlug: CRMCategorySlug;
  entityType: EntityType;
  entityId?: string | null;
  initialData?: Record<string, any>;
  onSave?: (data: Record<string, any>) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit' | 'view';
}

export function DynamicEntityForm({
  categorySlug,
  entityType,
  entityId,
  initialData = {},
  onSave,
  onCancel,
  mode = 'create',
}: DynamicEntityFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic_info']);

  // Get entity configuration
  const entityConfig = useMemo(() => {
    return getCategoryEntity(categorySlug, entityType);
  }, [categorySlug, entityType]);

  if (!entityConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Entity type "{entityType}" is not configured for this category.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionKey)
        ? prev.filter(k => k !== sectionKey)
        : [...prev, sectionKey]
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave?.(formData);
  };

  // Render field based on type
  const renderField = (field: CRMField) => {
    const value = formData[field.key] ?? field.defaultValue ?? '';
    const isDisabled = mode === 'view';
    
    const widthClass = {
      'full': 'col-span-12',
      'half': 'col-span-6',
      'third': 'col-span-4',
    }[field.width || 'full'];

    const fieldContent = () => {
      switch (field.type) {
        case 'text':
        case 'phone':
        case 'email':
        case 'url':
          return (
            <Input
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled={isDisabled}
            />
          );

        case 'textarea':
          return (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled={isDisabled}
              rows={3}
            />
          );

        case 'number':
        case 'currency':
        case 'percentage':
          return (
            <div className="relative">
              {field.type === 'currency' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              )}
              <Input
                type="number"
                value={value}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
                placeholder={field.placeholder || '0'}
                disabled={isDisabled}
                className={field.type === 'currency' ? 'pl-7' : ''}
              />
              {field.type === 'percentage' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              )}
            </div>
          );

        case 'date':
        case 'datetime':
          return (
            <Input
              type={field.type === 'datetime' ? 'datetime-local' : 'date'}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              disabled={isDisabled}
            />
          );

        case 'select':
          return (
            <Select
              value={value}
              onValueChange={(v) => handleFieldChange(field.key, v)}
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case 'multiselect':
          const selectedValues: string[] = Array.isArray(value) ? value : [];
          return (
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
              {field.options?.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      const newValues = isSelected
                        ? selectedValues.filter(v => v !== opt.value)
                        : [...selectedValues, opt.value];
                      handleFieldChange(field.key, newValues);
                    }}
                    className={`
                      px-3 py-1 text-sm rounded-full transition-colors
                      ${isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                      }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          );

        case 'boolean':
          return (
            <div className="flex items-center space-x-2">
              <Switch
                checked={!!value}
                onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
                disabled={isDisabled}
              />
              <span className="text-sm text-muted-foreground">
                {value ? 'Yes' : 'No'}
              </span>
            </div>
          );

        case 'address':
          return (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder="Enter full address"
              disabled={isDisabled}
              rows={2}
            />
          );

        default:
          return (
            <Input
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={isDisabled}
            />
          );
      }
    };

    return (
      <div key={field.key} className={widthClass}>
        <Label htmlFor={field.key} className="mb-2 block">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {fieldContent()}
        {field.helpText && (
          <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
        )}
      </div>
    );
  };

  // Render section
  const renderSection = (section: CRMSection) => {
    if (!section.enabled) return null;
    
    const isExpanded = expandedSections.includes(section.key);

    return (
      <Collapsible 
        key={section.key} 
        open={isExpanded}
        onOpenChange={() => toggleSection(section.key)}
      >
        <Card className="mb-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{section.label}</CardTitle>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-12 gap-4">
                {section.fields.map(renderField)}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? `New ${entityConfig.label}` : entityConfig.label}
          </h3>
          <p className="text-sm text-muted-foreground">
            {mode === 'view' ? 'View details' : 'Fill in the information below'}
          </p>
        </div>
        
        {mode !== 'view' && (
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            <Button type="submit">
              <Save className="h-4 w-4 mr-1" />
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {entityConfig.sections
        .sort((a, b) => a.order - b.order)
        .map(renderSection)}
    </form>
  );
}
