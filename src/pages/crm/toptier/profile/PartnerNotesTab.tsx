/**
 * Partner Notes Tab - Timestamped internal notes
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, Edit, Trash2, Pin, User, Calendar,
  StickyNote
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerNotesTabProps {
  partner: any;
  isSimulated: boolean;
}

export default function PartnerNotesTab({ partner, isSimulated }: PartnerNotesTabProps) {
  const { partnerId } = useParams();
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Simulated notes
  const [notes, setNotes] = useState([
    { id: '1', content: 'Great partner to work with. Always responsive and professional. Recommend for premium bookings.', date: new Date(Date.now() - 86400000 * 3), user: 'Admin', isPinned: true },
    { id: '2', content: 'Negotiated 2% higher commission for exclusive deals. Approved by management.', date: new Date(Date.now() - 86400000 * 15), user: 'Admin', isPinned: false },
    { id: '3', content: 'Partner prefers text communication over calls for quick updates. Best times to reach: 9am-12pm.', date: new Date(Date.now() - 86400000 * 30), user: 'Sarah', isPinned: false },
    { id: '4', content: 'Discussed potential for new helicopter tour package. Will follow up next week with pricing details.', date: new Date(Date.now() - 86400000 * 45), user: 'Admin', isPinned: false },
  ]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const note = {
      id: `note-${Date.now()}`,
      content: newNote,
      date: new Date(),
      user: 'Admin',
      isPinned: false
    };

    setNotes([note, ...notes]);
    setNewNote('');
  };

  const handleEditNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditingContent(note.content);
    }
  };

  const handleSaveEdit = () => {
    if (!editingContent.trim() || !editingNoteId) return;
    
    setNotes(notes.map(n => 
      n.id === editingNoteId 
        ? { ...n, content: editingContent, date: new Date() }
        : n
    ));
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter(n => n.id !== noteId));
  };

  const handleTogglePin = (noteId: string) => {
    setNotes(notes.map(n => 
      n.id === noteId ? { ...n, isPinned: !n.isPinned } : n
    ));
  };

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.date.getTime() - a.date.getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Notes
          {isSimulated && <SimulationBadge />}
        </h2>
      </div>

      {/* Add Note */}
      <Card>
        <CardContent className="pt-6">
          <Textarea
            placeholder="Add a note about this partner..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            className="mb-4"
          />
          <div className="flex justify-end">
            <Button onClick={handleAddNote} disabled={!newNote.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <EmptyStateWithGuidance
          icon={StickyNote}
          title="No Notes Yet"
          description="Add internal notes to track important information about this partner."
        />
      ) : (
        <div className="space-y-4">
          {sortedNotes.map((note) => (
            <Card 
              key={note.id}
              className={note.isPinned ? 'border-yellow-500/50 bg-yellow-500/5' : ''}
            >
              <CardContent className="p-4">
                {editingNoteId === note.id ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {note.isPinned && (
                          <div className="flex items-center gap-1 text-yellow-600 text-xs mb-2">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {note.user}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(note.date, 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleTogglePin(note.id)}
                          className={note.isPinned ? 'text-yellow-600' : ''}
                        >
                          <Pin className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditNote(note.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
