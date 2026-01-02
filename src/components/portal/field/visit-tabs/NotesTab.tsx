import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { StickyNote, Calendar } from 'lucide-react';

interface NotesTabProps {
  internalNotes: string;
  relationshipNotes: string;
  nextFollowUp: string;
  nextFollowUpDate: string | null;
  onNotesChange: (updates: {
    internalNotes?: string;
    relationshipNotes?: string;
    nextFollowUp?: string;
    nextFollowUpDate?: string | null;
  }) => void;
}

export function NotesTab({ 
  internalNotes, 
  relationshipNotes, 
  nextFollowUp, 
  nextFollowUpDate, 
  onNotesChange 
}: NotesTabProps) {
  return (
    <div className="space-y-4">
      {/* Internal Ops Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Internal Operations Notes
          </CardTitle>
          <CardDescription>
            Notes for internal team use only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={internalNotes}
            onChange={(e) => onNotesChange({ internalNotes: e.target.value })}
            placeholder="Internal observations, issues, special handling requirements..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Relationship Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Relationship Notes</CardTitle>
          <CardDescription>
            Notes about the business relationship
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={relationshipNotes}
            onChange={(e) => onNotesChange({ relationshipNotes: e.target.value })}
            placeholder="Relationship history, preferences, sensitivities..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Next Follow-Up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Next Follow-Up
          </CardTitle>
          <CardDescription>
            Schedule the next action for this store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Follow-Up Action</Label>
            <Textarea
              value={nextFollowUp}
              onChange={(e) => onNotesChange({ nextFollowUp: e.target.value })}
              placeholder="What needs to be done next time?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Follow-Up Date</Label>
            <Input
              type="date"
              value={nextFollowUpDate || ''}
              onChange={(e) => onNotesChange({ nextFollowUpDate: e.target.value || null })}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
