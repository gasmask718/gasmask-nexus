import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

export type FieldType = 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'select' | 'switch' | 'date' | 'datetime';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  validation?: z.ZodTypeAny;
}

interface EntityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldConfig[];
  defaultValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export function EntityModal({
  open,
  onOpenChange,
  title,
  description,
  fields,
  defaultValues = {},
  onSubmit,
  isLoading = false,
  mode = 'create',
}: EntityModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Build dynamic schema
  const schemaShape: Record<string, z.ZodTypeAny> = {};
  fields.forEach((field) => {
    if (field.validation) {
      schemaShape[field.name] = field.validation;
    } else if (field.type === 'number') {
      // Handle number fields properly - transform NaN to undefined, then validate
      if (field.required) {
        schemaShape[field.name] = z.preprocess(
          (val) => (val === '' || Number.isNaN(val) ? undefined : val),
          z.number({ required_error: `${field.label} is required`, invalid_type_error: `${field.label} must be a number` })
            .min(0, `${field.label} must be 0 or greater`)
        );
      } else {
        schemaShape[field.name] = z.preprocess(
          (val) => (val === '' || Number.isNaN(val) ? undefined : val),
          z.number().optional()
        );
      }
    } else if (field.required) {
      // For select fields, ensure empty string is treated as missing
      if (field.type === 'select') {
        schemaShape[field.name] = z.string({ required_error: `${field.label} is required` })
          .min(1, `${field.label} is required`);
      } else {
        schemaShape[field.name] = z.string().min(1, `${field.label} is required`);
      }
    } else {
      schemaShape[field.name] = z.any().optional();
    }
  });
  const schema = z.object(schemaShape);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onSubmit', // Validate on submit
    reValidateMode: 'onChange', // Re-validate on change after first submit
  });

  // Reset form when modal opens with new default values
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only reset when modal opens, not on every defaultValues change

  const handleSubmit = async (data: Record<string, any>) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FieldConfig) => {
    const error = form.formState.errors[field.name];

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              {...form.register(field.name)}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Select
              value={form.watch(field.name) || ''}
              onValueChange={(value) => {
                form.setValue(field.name, value, { shouldValidate: true });
              }}
            >
              <SelectTrigger className={error ? 'border-destructive' : ''}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );

      case 'switch':
        return (
          <div key={field.name} className="flex items-center justify-between space-y-0">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Switch
              id={field.name}
              checked={form.watch(field.name) || false}
              onCheckedChange={(checked) => form.setValue(field.name, checked)}
            />
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Input
              id={field.name}
              type="number"
              placeholder={field.placeholder}
              {...form.register(field.name, { valueAsNumber: true })}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Input
              id={field.name}
              type="date"
              {...form.register(field.name)}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );

      case 'datetime':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Input
              id={field.name}
              type="datetime-local"
              {...form.register(field.name)}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );

      default:
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}{field.required && ' *'}</Label>
            <Input
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              {...form.register(field.name)}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-xs text-destructive">{String(error.message)}</p>}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {fields.map(renderField)}
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || isLoading}>
              {(submitting || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
