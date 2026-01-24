import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { SpeakerStyleProfile } from '@/hooks/usePlaybooks';

interface StyleEditorProps {
  style?: SpeakerStyleProfile | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<SpeakerStyleProfile>) => void;
  businessId: string;
}

export function StyleEditor({
  style,
  open,
  onClose,
  onSave,
  businessId,
}: StyleEditorProps) {
  const [name, setName] = useState(style?.name ?? '');
  const [description, setDescription] = useState(style?.description ?? '');
  const [tone, setTone] = useState(style?.tone ?? 'professional');
  const [pacing, setPacing] = useState(style?.pacing ?? 'moderate');
  const [energyLevel, setEnergyLevel] = useState(style?.energy_level ?? 'medium');
  const [formalityLevel, setFormalityLevel] = useState(style?.formality_level ?? 50);
  const [maxEnthusiasm, setMaxEnthusiasm] = useState(style?.max_enthusiasm_level ?? 70);
  const [usesHumor, setUsesHumor] = useState(style?.uses_humor ?? false);
  const [usesStories, setUsesStories] = useState(style?.uses_stories ?? false);
  const [usesQuestions, setUsesQuestions] = useState(style?.uses_questions ?? true);
  const [mirroringEnabled, setMirroringEnabled] = useState(style?.mirroring_enabled ?? false);
  
  const [greetings, setGreetings] = useState<string[]>(style?.greeting_examples ?? []);
  const [closings, setClosings] = useState<string[]>(style?.closing_examples ?? []);
  const [empathy, setEmpathy] = useState<string[]>(style?.empathy_expressions ?? []);
  
  const [newGreeting, setNewGreeting] = useState('');
  const [newClosing, setNewClosing] = useState('');
  const [newEmpathy, setNewEmpathy] = useState('');

  const addToList = (
    value: string,
    setValue: (v: string) => void,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    if (value.trim()) {
      setList([...list, value.trim()]);
      setValue('');
    }
  };

  const removeFromList = (index: number, list: string[], setList: (l: string[]) => void) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      business_id: businessId,
      name,
      description: description || null,
      tone,
      pacing,
      energy_level: energyLevel,
      formality_level: formalityLevel,
      max_enthusiasm_level: maxEnthusiasm,
      uses_humor: usesHumor,
      uses_stories: usesStories,
      uses_questions: usesQuestions,
      mirroring_enabled: mirroringEnabled,
      greeting_examples: greetings,
      closing_examples: closings,
      empathy_expressions: empathy,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {style ? 'Edit Style Profile' : 'Create Style Profile'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Warm & Friendly"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When should this style be used?"
                rows={2}
              />
            </div>
          </div>

          {/* Tone, Pacing, Energy */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="energetic">Energetic</SelectItem>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pacing</Label>
              <Select value={pacing} onValueChange={setPacing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Energy Level</Label>
              <Select value={energyLevel} onValueChange={setEnergyLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label>Formality: {formalityLevel}%</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Low = casual, High = formal
              </p>
              <Slider
                value={[formalityLevel]}
                onValueChange={([v]) => setFormalityLevel(v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div>
              <Label>Max Enthusiasm: {maxEnthusiasm}%</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Caps how excited AI can sound
              </p>
              <Slider
                value={[maxEnthusiasm]}
                onValueChange={([v]) => setMaxEnthusiasm(v)}
                min={20}
                max={100}
                step={5}
              />
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Uses Humor</Label>
                <p className="text-xs text-muted-foreground">Allow light humor</p>
              </div>
              <Switch checked={usesHumor} onCheckedChange={setUsesHumor} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Uses Stories</Label>
                <p className="text-xs text-muted-foreground">Tell anecdotes</p>
              </div>
              <Switch checked={usesStories} onCheckedChange={setUsesStories} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Uses Questions</Label>
                <p className="text-xs text-muted-foreground">Ask clarifying questions</p>
              </div>
              <Switch checked={usesQuestions} onCheckedChange={setUsesQuestions} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Mirroring</Label>
                <p className="text-xs text-muted-foreground">Match caller's pace</p>
              </div>
              <Switch checked={mirroringEnabled} onCheckedChange={setMirroringEnabled} />
            </div>
          </div>

          {/* Greeting Examples */}
          <div>
            <Label>Greeting Examples (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Display-only reference phrases
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                value={newGreeting}
                onChange={(e) => setNewGreeting(e.target.value)}
                placeholder="e.g., Hi there! How can I help today?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newGreeting, setNewGreeting, greetings, setGreetings);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newGreeting, setNewGreeting, greetings, setGreetings)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {greetings.map((g, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  "{g.slice(0, 30)}..."
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(i, greetings, setGreetings)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Empathy Expressions */}
          <div>
            <Label>Empathy Expressions (optional)</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newEmpathy}
                onChange={(e) => setNewEmpathy(e.target.value)}
                placeholder="e.g., I completely understand..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addToList(newEmpathy, setNewEmpathy, empathy, setEmpathy);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addToList(newEmpathy, setNewEmpathy, empathy, setEmpathy)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {empathy.map((e, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  "{e.slice(0, 30)}..."
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFromList(i, empathy, setEmpathy)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {style ? 'Save Changes' : 'Create Style'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
