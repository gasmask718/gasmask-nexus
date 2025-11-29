import { useState, useEffect, useRef } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type FieldType = 'text' | 'number' | 'dropdown' | 'date' | 'textarea' | 'toggle' | 'select';

interface SelectOption {
  value: string;
  label: string;
}

interface EditableFieldProps {
  value: string | number | boolean | null;
  field: string;
  type?: FieldType;
  options?: SelectOption[];
  editable?: boolean;
  onSave: (field: string, value: string | number | boolean | null) => Promise<void>;
  className?: string;
  placeholder?: string;
  label?: string;
  inline?: boolean;
}

export function EditableField({
  value: initialValue,
  field,
  type = 'text',
  options = [],
  editable = true,
  onSave,
  className,
  placeholder,
  label,
  inline = false,
}: EditableFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  
  const hasChanged = value !== initialValue;

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!hasChanged) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(field, value);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleRevert();
    }
  };

  if (!editable) {
    return (
      <div className={cn('text-sm', className)}>
        {label && <span className="text-muted-foreground text-xs block mb-1">{label}</span>}
        <span className="text-foreground">
          {type === 'toggle' ? (value ? 'Yes' : 'No') : String(value ?? '-')}
        </span>
      </div>
    );
  }

  // Toggle type
  if (type === 'toggle') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {label && <span className="text-muted-foreground text-sm">{label}</span>}
        <Switch
          checked={Boolean(value)}
          onCheckedChange={async (checked) => {
            setValue(checked);
            setIsSaving(true);
            try {
              await onSave(field, checked);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 1500);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
        />
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {showSuccess && <Check className="h-3 w-3 text-green-500" />}
      </div>
    );
  }

  // Select/Dropdown type
  if (type === 'dropdown' || type === 'select') {
    return (
      <div className={cn('space-y-1', className)}>
        {label && <span className="text-muted-foreground text-xs block">{label}</span>}
        <div className="flex items-center gap-2">
          <Select
            value={String(value ?? '')}
            onValueChange={async (newValue) => {
              setValue(newValue);
              setIsSaving(true);
              try {
                await onSave(field, newValue);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 1500);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder={placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {showSuccess && <Check className="h-3 w-3 text-green-500" />}
        </div>
      </div>
    );
  }

  // Inline display mode
  if (inline && !isEditing) {
    return (
      <div
        className={cn(
          'cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors group',
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <span className="text-foreground">
          {String(value ?? placeholder ?? '-')}
        </span>
        {showSuccess && <Check className="h-3 w-3 text-green-500 inline ml-2" />}
      </div>
    );
  }

  // Full edit mode
  const InputComponent = type === 'textarea' ? Textarea : Input;

  return (
    <div className={cn('space-y-1', className)}>
      {label && <span className="text-muted-foreground text-xs block">{label}</span>}
      <div className="flex items-center gap-2">
        <InputComponent
          ref={inputRef as any}
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => setValue(type === 'number' ? Number(e.target.value) : e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!hasChanged) setIsEditing(false);
          }}
          placeholder={placeholder}
          className={cn(
            'h-8',
            type === 'textarea' && 'min-h-[80px] h-auto',
            hasChanged && 'border-primary'
          )}
          disabled={isSaving}
        />
        
        {hasChanged && !isSaving && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-green-600 hover:text-green-700"
              onClick={handleSave}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleRevert}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {showSuccess && !hasChanged && <Check className="h-4 w-4 text-green-500" />}
      </div>
    </div>
  );
}
