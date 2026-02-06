import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidEmail, normalizeEmail } from '@/utils/validation/validationEngine';

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  autoHeal?: boolean;
}

/**
 * Email input with inline validation feedback and auto-correction.
 * Drop-in replacement for <Input type="email" />.
 */
export function EmailInput({
  value,
  onChange,
  autoHeal = true,
  className,
  ...props
}: EmailInputProps) {
  const [touched, setTouched] = useState(false);
  const [healed, setHealed] = useState(false);

  const trimmed = value.trim();
  const normalized = normalizeEmail(trimmed);
  const valid = !trimmed || isValidEmail(trimmed);
  const canHeal = !valid && trimmed.length > 0 && isValidEmail(normalized);

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (autoHeal && canHeal) {
      onChange(normalized);
      setHealed(true);
      setTimeout(() => setHealed(false), 2000);
    }
  }, [autoHeal, canHeal, normalized, onChange]);

  const showError = touched && trimmed.length > 0 && !valid && !canHeal;
  const showHealHint = touched && canHeal && !autoHeal;
  const showSuccess = healed;

  return (
    <div className="space-y-1">
      <Input
        type="email"
        value={value}
        onChange={(e) => { onChange(e.target.value); setHealed(false); }}
        onBlur={handleBlur}
        onFocus={() => setTouched(true)}
        className={cn(
          className,
          showError && 'border-destructive focus-visible:ring-destructive',
          showHealHint && 'border-amber-500 focus-visible:ring-amber-500',
        )}
        {...props}
      />
      {showError && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          Please enter a valid email address
        </p>
      )}
      {showHealHint && (
        <p className="flex items-center gap-1 text-xs text-amber-500 cursor-pointer" onClick={() => { onChange(normalized); setHealed(true); }}>
          <Lightbulb className="h-3 w-3" />
          Did you mean <span className="font-medium underline">{normalized}</span>?
        </p>
      )}
      {showSuccess && (
        <p className="flex items-center gap-1 text-xs text-green-500">
          <CheckCircle className="h-3 w-3" />
          Auto-corrected
        </p>
      )}
    </div>
  );
}
