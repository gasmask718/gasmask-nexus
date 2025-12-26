import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  ArrowLeft, FileText, Plus, Edit2, Trash2, Clock, User, Loader2, Save
} from "lucide-react";
import { useStaffMember } from '@/hooks/useUnforgettableStaff';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface StaffNote {
  id: string;
  content: string;
  author: string;
  authorInitials: string;
  createdAt: string;
  updatedAt?: string;
  isOwn: boolean;
}

const generateMockNotes = (): StaffNote[] => [
  {
    id: 'n1',
    content: 'Excellent performance at the Garcia Wedding. Multiple compliments from guests about professionalism and attention to detail.',
    author: 'Sarah Johnson',
    authorInitials: 'SJ',
    createdAt: '2024-01-20T14:30:00Z',
    isOwn: false,
  },
  {
    id: 'n2',
    content: 'Completed food safety certification training. Certificate uploaded to documents.',
    author: 'Mike Wilson',
    authorInitials: 'MW',
    createdAt: '2024-01-15T10:00:00Z',
    isOwn: true,
  },
  {
    id: 'n3',
    content: 'Requested schedule change for March - prefers weekend events only due to personal commitments.',
    author: 'Current User',
    authorInitials: 'CU',
    createdAt: '2024-01-10T09:15:00Z',
    updatedAt: '2024-01-12T11:30:00Z',
    isOwn: true,
  },
  {
    id: 'n4',
    content: 'Promoted from setup crew member to setup crew lead based on consistent performance.',
    author: 'Admin',
    authorInitials: 'AD',
    createdAt: '2023-12-01T16:45:00Z',
    isOwn: false,
  },
];

export default function UnforgettableStaffNotes() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const { simulationMode } = useSimulationMode();
  const { data: staffMember, isLoading } = useStaffMember(staffId);
  
  const [notes, setNotes] = useState<StaffNote[]>(generateMockNotes());
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }

    const note: StaffNote = {
      id: `n-${Date.now()}`,
      content: newNote.trim(),
      author: 'Current User',
      authorInitials: 'CU',
      createdAt: new Date().toISOString(),
      isOwn: true,
    };

    setNotes([note, ...notes]);
    setNewNote('');
    setIsAdding(false);
    toast.success('Note added successfully');
  };

  const handleEditNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditContent(note.content);
    }
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) {
      toast.error('Note cannot be empty');
      return;
    }

    setNotes(notes.map(n => 
      n.id === editingNoteId 
        ? { ...n, content: editContent.trim(), updatedAt: new Date().toISOString() }
        : n
    ));
    setEditingNoteId(null);
    setEditContent('');
    toast.success('Note updated');
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes(notes.filter(n => n.id !== noteId));
    toast.success('Note deleted');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
      </div>
    );
  }

  const staffName = staffMember 
    ? `${staffMember.first_name} ${staffMember.last_name}`
    : 'Staff Member';

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          <h1 className="text-2xl font-bold">Staff Notes</h1>
          <p className="text-muted-foreground">Notes and comments for {staffName}</p>
        </div>
        
        {!isAdding && (
          <Button 
            onClick={() => setIsAdding(true)}
            className="bg-gradient-to-r from-pink-600 to-purple-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {simulationMode && (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          Simulation Mode - Changes won't be saved
        </Badge>
      )}

      {/* Add Note Form */}
      {isAdding && (
        <Card className="border-border/50 border-pink-500/30">
          <CardHeader>
            <CardTitle className="text-base">Add New Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter your note about this staff member..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsAdding(false); setNewNote(''); }}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} className="bg-gradient-to-r from-pink-600 to-purple-500">
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Timeline */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-pink-500" />
            Notes Timeline ({notes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Notes Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add notes to track important information about this staff member.
              </p>
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Note
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
              
              <div className="space-y-6">
                {notes.map((note, index) => (
                  <div key={note.id} className="relative pl-14">
                    {/* Timeline dot */}
                    <div className="absolute left-4 w-4 h-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 border-2 border-background" />
                    
                    <Card className={`border-border/50 ${editingNoteId === note.id ? 'border-pink-500/50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-muted">
                                {note.authorInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{note.author}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}</span>
                                {note.updatedAt && (
                                  <span className="text-muted-foreground/70">(edited)</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {note.isOwn && editingNoteId !== note.id && (
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditNote(note.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteNote(note.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              className="resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => { setEditingNoteId(null); setEditContent(''); }}
                              >
                                Cancel
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit}>
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{note.content}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
