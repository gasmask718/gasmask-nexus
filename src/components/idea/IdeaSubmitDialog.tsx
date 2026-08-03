import { useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Camera, ImagePlus, Lightbulb, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { mutationErrorMessage } from '@/lib/verifiedMutation';
import {
  IDEA_CATEGORIES,
  IDEA_PRIORITIES,
  useSubmitIdea,
} from '@/hooks/useIdeaBox';

const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024;

const CATEGORY_LABEL: Record<string, string> = {
  improvement: 'Improvement',
  bug: 'Something is broken',
  new_feature: 'New feature',
  data_quality: 'Wrong / missing data',
  field_ops: 'Field operations',
  other: 'Other',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IdeaSubmitDialog({ open, onOpenChange }: Props) {
  const location = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const submit = useSubmitIdea();

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('improvement');
  const [priority, setPriority] = useState<string>('normal');
  const [files, setFiles] = useState<File[]>([]);

  const reset = () => {
    setTitle('');
    setBody('');
    setCategory('improvement');
    setPriority('normal');
    setFiles([]);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast({
        title: 'Photo too large',
        description: `${tooBig.name} is over 8 MB.`,
        variant: 'destructive',
      });
      return;
    }
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: 'Missing details',
        description: 'Give it a short title and describe the idea.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await submit.mutateAsync({
        title,
        body,
        category,
        priority,
        routePath: location.pathname + location.search,
        routeLabel: document.title || null,
        storeId: (params.id as string | undefined) ?? null,
        recordType: params.id ? 'route_param_id' : null,
        recordId: (params.id as string | undefined) ?? null,
        files,
        submitterName: (user?.user_metadata?.full_name as string) ?? null,
        submitterEmail: user?.email ?? null,
        submitterRole: userRole ?? null,
      });

      toast({
        title: 'Idea submitted',
        description: 'Thanks — it landed in the Idea Box for review.',
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Could not submit',
        description: mutationErrorMessage(e),
        variant: 'destructive',
        duration: 8000,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submit.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Submit an idea
          </DialogTitle>
          <DialogDescription>
            Anything that would make your job easier — an improvement, something
            broken, or bad data. We capture the page you&apos;re on automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="idea-title">Title</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary"
              maxLength={160}
            />
          </div>

          <div>
            <Label htmlFor="idea-body">What&apos;s the idea?</Label>
            <Textarea
              id="idea-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Describe what happened or what should change…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDEA_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IDEA_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Photos ({files.length}/{MAX_FILES})</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={files.length >= MAX_FILES}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={files.length >= MAX_FILES}
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="relative h-16 w-16 overflow-hidden rounded border"
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`Attachment preview ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-background/90 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            Captured with your idea:{' '}
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              {location.pathname}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submit.isPending ? 'Submitting…' : 'Submit idea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
