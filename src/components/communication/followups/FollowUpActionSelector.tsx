import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MessageSquare, User } from 'lucide-react';

interface FollowUpActionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const actions = [
  { value: 'ai_call', label: 'AI Call', icon: Phone, description: 'Automated AI voice call' },
  { value: 'ai_text', label: 'AI Text', icon: MessageSquare, description: 'Automated AI SMS' },
  { value: 'manual_call', label: 'Manual Call', icon: User, description: 'Human agent call' },
  { value: 'manual_text', label: 'Manual Text', icon: User, description: 'Human agent SMS' },
];

export function FollowUpActionSelector({ value, onChange, disabled }: FollowUpActionSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select action type" />
      </SelectTrigger>
      <SelectContent>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <SelectItem key={action.value} value={action.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{action.label}</span>
                <span className="text-xs text-muted-foreground">— {action.description}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
