import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Sparkles } from 'lucide-react';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'charismatic', label: 'Charismatic', emoji: '✨' },
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'street', label: 'Street', emoji: '🔥' },
  { value: 'luxury', label: 'Luxury', emoji: '👑' },
  { value: 'high-energy', label: 'High-Energy', emoji: '⚡' },
  { value: 'calm', label: 'Calm', emoji: '🧘' },
];

interface ToneSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        Voice Tone
      </Label>
      <ToggleGroup 
        type="single" 
        value={value} 
        onValueChange={(v) => v && onChange(v)}
        className="flex flex-wrap gap-2 justify-start"
      >
        {TONE_OPTIONS.map((tone) => (
          <ToggleGroupItem 
            key={tone.value} 
            value={tone.value}
            className="text-xs px-3 py-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <span className="mr-1">{tone.emoji}</span>
            {tone.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
