// Phase 12 - Safe CRUD Mode with Live Validation

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  normalizePhone,
  normalizeEmail,
  isValidEmail,
  isValidPhone,
  isValidZip,
} from '@/utils/validation/validationEngine';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'money' | 'zip' | 'textarea';

interface ValidatedFormFieldProps {
  name: string;
  label: string;
  type?: FieldType;
  value: string | number;
  onChange: (value: string | number) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoHeal?: boolean;
  className?: string;
}

interface ValidationState {
  isValid: boolean;
  message: string | null;
  suggestion: string | null;
}

export function ValidatedFormField({
  name,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder,
  disabled = false,
  autoHeal = true,
  className,
}: ValidatedFormFieldProps) {
  const [validation, setValidation] = useState<ValidationState>({
    isValid: true,
    message: null,
    suggestion: null,
  });
  const [isTouched, setIsTouched] = useState(false);

  useEffect(() => {
    if (!isTouched) return;
    validateValue(String(value));
  }, [value, isTouched]);

  const validateValue = (val: string) => {
    const newValidation: ValidationState = {
      isValid: true,
      message: null,
      suggestion: null,
    };

    // Required check
    if (required && !val.trim()) {
      newValidation.isValid = false;
      newValidation.message = `${label} is required`;
      setValidation(newValidation);
      return;
    }

    if (!val.trim()) {
      setValidation(newValidation);
      return;
    }

    // Type-specific validation
    switch (type) {
      case 'email':
        if (!isValidEmail(val)) {
          const normalized = normalizeEmail(val);
          if (isValidEmail(normalized)) {
            newValidation.suggestion = normalized;
            newValidation.message = 'Email can be auto-corrected';
          } else {
            newValidation.isValid = false;
            newValidation.message = 'Invalid email format';
          }
        }
        break;

      case 'phone':
        const normalizedPhone = normalizePhone(val);
        if (!isValidPhone(normalizedPhone)) {
          newValidation.isValid = false;
          newValidation.message = 'Invalid phone format (XXX-XXX-XXXX)';
        } else if (normalizedPhone !== val) {
          newValidation.suggestion = normalizedPhone;
          newValidation.message = 'Phone can be formatted';
        }
        break;

      case 'zip':
        if (!isValidZip(val)) {
          newValidation.isValid = false;
          newValidation.message = 'Invalid ZIP code';
        }
        break;

      case 'number':
      case 'money':
        const num = Number(val);
        if (isNaN(num)) {
          newValidation.isValid = false;
          newValidation.message = 'Must be a valid number';
        } else if (type === 'money' && num < 0) {
          newValidation.isValid = false;
          newValidation.message = 'Amount cannot be negative';
        }
        break;
    }

    setValidation(newValidation);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let newValue: string | number = e.target.value;
    
    if (type === 'number' || type === 'money') {
      const num = Number(newValue);
      if (!isNaN(num)) {
        newValue = num;
      }
    }
    
    onChange(newValue);
  };

  const handleBlur = () => {
    setIsTouched(true);
    
    // Auto-heal on blur if enabled
    if (autoHeal && validation.suggestion) {
      onChange(validation.suggestion);
      setValidation({
        isValid: true,
        message: 'Auto-corrected',
        suggestion: null,
      });
    }
  };

  const applySuggestion = () => {
    if (validation.suggestion) {
      onChange(validation.suggestion);
      setValidation({
        isValid: true,
        message: null,
        suggestion: null,
      });
    }
  };

  const inputClassName = cn(
    'transition-colors',
    !validation.isValid && isTouched && 'border-red-500 focus-visible:ring-red-500',
    validation.suggestion && 'border-amber-500 focus-visible:ring-amber-500'
  );

  const InputComponent = type === 'textarea' ? Textarea : Input;
  const inputType = type === 'email' ? 'email' : type === 'number' || type === 'money' ? 'number' : 'text';

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={name} className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      
      <InputComponent
        id={name}
        name={name}
        type={inputType}
        value={String(value)}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => setIsTouched(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        step={type === 'money' ? '0.01' : undefined}
      />

      {/* Validation Feedback */}
      {isTouched && (
        <div className="flex items-center gap-2">
          {!validation.isValid && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">{validation.message}</span>
            </div>
          )}
          
          {validation.isValid && validation.message && !validation.suggestion && (
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle className="h-3 w-3" />
              <span className="text-xs">{validation.message}</span>
            </div>
          )}

          {validation.suggestion && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-amber-500">
                <Lightbulb className="h-3 w-3" />
                <span className="text-xs">{validation.message}</span>
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] cursor-pointer hover:bg-amber-500/20"
                onClick={applySuggestion}
              >
                Apply: {validation.suggestion}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
