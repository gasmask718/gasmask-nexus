import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { useSmartNoteComposer } from '@/hooks/useCommandBrain';
import { toast } from 'sonner';

interface SmartNoteComposerProps {
  storeName?: string;
  onNoteComposed?: (note: string) => void;
}

export function SmartNoteComposer({ storeName, onNoteComposed }: SmartNoteComposerProps) {
  const [open, setOpen] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [composedNote, setComposedNote] = useState('');
  const [copied, setCopied] = useState(false);
  const { composeNote, isComposing } = useSmartNoteComposer();

  const handleCompose = async () => {
    if (!rawInput.trim()) return;
    const result = await composeNote(rawInput, storeName);
    if (result) {
      setComposedNote(result);
    }
  };

  const handleUseNote = () => {
    if (composedNote) {
      onNoteComposed?.(composedNote);
      toast.success('Note ready to save');
      setOpen(false);
      setRawInput('');
      setComposedNote('');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(composedNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          AI Compose
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Note Composer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Quick notes / bullet points</label>
            <Textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="e.g. ali was there, not selling gasmask in morning, come back afternoon, interested in hotscalati bros"
              rows={3}
              className="text-sm"
            />
          </div>

          <Button onClick={handleCompose} disabled={isComposing || !rawInput.trim()} className="w-full gap-2">
            {isComposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isComposing ? 'Composing...' : 'Compose Professional Note'}
          </Button>

          {composedNote && (
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">AI-Composed Note</span>
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 gap-1 text-xs">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans">{composedNote}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        {composedNote && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComposedNote(''); }}>Recompose</Button>
            <Button onClick={handleUseNote}>Use This Note</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
