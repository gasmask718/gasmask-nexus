/**
 * FeedbackDialog — Reusable bug/feedback submission modal.
 * Auto-captures current route as page_context.
 */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function deriveContext(pathname: string): string {
  // Strip leading slash, take first 2-3 segments for human readability
  const parts = pathname.split('/').filter(Boolean).slice(0, 3);
  return parts.length ? parts.join(' / ') : 'home';
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const location = useLocation();
  const { role } = useUserRole();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<string>('bug');
  const [severity, setSeverity] = useState<string>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const pageContext = `${deriveContext(location.pathname)} (${location.pathname})`;

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be signed in to submit feedback');
        setSubmitting(false);
        return;
      }
      const submitterRole = (role as string) || 'other';
      const { error } = await supabase.from('feedback_submissions').insert({
        submitted_by: user.id,
        submitter_role: submitterRole,
        type,
        title: title.trim(),
        description: description.trim(),
        severity: severity || null,
        page_context: pageContext,
      });
      if (error) throw error;
      toast.success('Feedback sent — thank you!');
      qc.invalidateQueries({ queryKey: ['feedback_submissions'] });
      setTitle('');
      setDescription('');
      setType('bug');
      setSeverity('medium');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem or suggestion</DialogTitle>
          <DialogDescription>
            We're on the page <span className="font-mono text-xs">{pageContext}</span>. Tell us what's wrong or what to improve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="not_working">Not working</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? What were you trying to do?" rows={5} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackDialog;
