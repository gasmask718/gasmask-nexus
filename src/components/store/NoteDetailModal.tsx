import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Clock, User, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface Note {
  id: string;
  note_text: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    name: string;
    role?: string;
  } | null;
}

interface NoteDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
}

// Helper function to determine source from role
const getSourceFromRole = (role?: string | null): string => {
  if (!role) return "System";
  const roleLower = role.toLowerCase();
  if (roleLower === 'va' || roleLower.includes('va')) return "VA";
  if (roleLower === 'biker' || roleLower === 'driver') return "Biker";
  if (roleLower === 'admin' || roleLower === 'owner') return "Admin";
  if (roleLower.includes('ai') || roleLower === 'ai') return "AI";
  return "User";
};

export function NoteDetailModal({ open, onOpenChange, note }: NoteDetailModalProps) {
  if (!note) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Note</span>
              <p className="text-sm font-normal text-muted-foreground">
                Store Note
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Note Content */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Note Content
            </div>
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg max-h-[60vh] overflow-y-auto break-words whitespace-pre-wrap min-w-0">
              {note.note_text}
            </div>
          </div>

          <Separator />

          {/* Meta Info */}
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(note.created_at), 'EEEE, MMMM d, yyyy at h:mm a')}</span>
            </div>
            {note.profile?.name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  Created by: <span className="text-foreground font-medium">{note.profile.name}</span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {getSourceFromRole(note.profile.role)}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

