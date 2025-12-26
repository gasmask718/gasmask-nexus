/**
 * TopTier Note Detail Page
 * Full view of a partner note
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Edit, FileText, Calendar, User, Building2, Trash2
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TopTierNoteDetail() {
  const navigate = useNavigate();
  const { partnerId, noteId } = useParams<{ partnerId: string; noteId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Generate simulated notes
  const simulatedNotes = useMemo(() => [
    { id: 'note1', partner_id: partnerId, title: 'Partnership Requirements', content: 'Partner requires 48-hour advance notice for all bookings. Weekend rates are 25% higher. Contact Sarah for any last-minute changes.', category: 'operational', created_by: 'John Smith', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'note2', partner_id: partnerId, title: 'Preferred Communication', content: 'Partner prefers email over phone calls. Best response times are weekday mornings.', category: 'communication', created_by: 'Jane Doe', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'note3', partner_id: partnerId, title: 'Discount Agreement', content: 'Negotiated 15% volume discount for bookings over $10,000. Valid through end of Q4.', category: 'financial', created_by: 'John Smith', created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString() },
  ], [partnerId]);

  const { data: notes, isSimulated } = useResolvedData([], simulatedNotes);

  const note = useMemo(() => {
    return notes.find((n: any) => n.id === noteId);
  }, [notes, noteId]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'operational':
        return <Badge className="bg-blue-500/10 text-blue-500">Operational</Badge>;
      case 'communication':
        return <Badge className="bg-purple-500/10 text-purple-500">Communication</Badge>;
      case 'financial':
        return <Badge className="bg-green-500/10 text-green-500">Financial</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const handleDelete = () => {
    if (isSimulated) {
      toast.info('Cannot delete in Simulation Mode');
    } else {
      toast.success('Note deleted');
      navigate(-1);
    }
  };

  if (!note) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Note not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The note you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{note.title}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getCategoryBadge(note.category)}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/notes/${noteId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Note
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Note Content */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="font-medium">{note.created_by}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(note.created_at), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{format(new Date(note.updated_at), 'MMMM d, yyyy')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Partner</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}`)}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">View Partner</p>
                  <p className="text-sm text-muted-foreground">Click to open</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
