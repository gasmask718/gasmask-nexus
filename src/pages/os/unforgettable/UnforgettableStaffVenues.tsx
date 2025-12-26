import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ArrowLeft, Building, MapPin, Users, Calendar, Plus, Trash2, Search, Loader2
} from "lucide-react";
import { useStaffMember } from '@/hooks/useUnforgettableStaff';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';

const US_STATES = ['All States', 'FL', 'TX', 'CA', 'NY', 'NV', 'AZ', 'GA', 'IL', 'PA', 'OH'];

// Mock venues for simulation
const generateMockVenues = () => [
  { id: 'v1', name: 'Grand Ballroom Miami', state: 'FL', city: 'Miami', capacity: 500, type: 'Ballroom', upcomingEvents: 3 },
  { id: 'v2', name: 'Skyline Terrace', state: 'FL', city: 'Fort Lauderdale', capacity: 200, type: 'Rooftop', upcomingEvents: 1 },
  { id: 'v3', name: 'Paradise Hall', state: 'FL', city: 'Orlando', capacity: 350, type: 'Banquet Hall', upcomingEvents: 2 },
  { id: 'v4', name: 'Ocean View Resort', state: 'FL', city: 'Miami Beach', capacity: 400, type: 'Resort', upcomingEvents: 0 },
  { id: 'v5', name: 'Casa Bella', state: 'TX', city: 'Houston', capacity: 250, type: 'Villa', upcomingEvents: 1 },
  { id: 'v6', name: 'Royal Gardens', state: 'CA', city: 'Los Angeles', capacity: 600, type: 'Garden', upcomingEvents: 4 },
  { id: 'v7', name: 'The Grand Plaza', state: 'NY', city: 'New York', capacity: 800, type: 'Ballroom', upcomingEvents: 5 },
  { id: 'v8', name: 'Desert Oasis', state: 'NV', city: 'Las Vegas', capacity: 450, type: 'Resort', upcomingEvents: 2 },
];

const generateMockAssignedVenues = () => [
  { id: 'av1', venueId: 'v1', name: 'Grand Ballroom Miami', state: 'FL', city: 'Miami', assignedDate: '2024-01-15', upcomingEvents: 3 },
  { id: 'av2', venueId: 'v2', name: 'Skyline Terrace', state: 'FL', city: 'Fort Lauderdale', assignedDate: '2024-02-01', upcomingEvents: 1 },
];

export default function UnforgettableStaffVenues() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const { simulationMode } = useSimulationMode();
  const { data: staffMember, isLoading } = useStaffMember(staffId);
  
  const [assignedVenues, setAssignedVenues] = useState(generateMockAssignedVenues());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('All States');

  const allVenues = useMemo(() => generateMockVenues(), []);
  
  const availableVenues = useMemo(() => {
    const assignedIds = assignedVenues.map(v => v.venueId);
    return allVenues.filter(v => {
      const notAssigned = !assignedIds.includes(v.id);
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesState = stateFilter === 'All States' || v.state === stateFilter;
      return notAssigned && matchesSearch && matchesState;
    });
  }, [allVenues, assignedVenues, searchTerm, stateFilter]);

  const handleAssignVenue = (venue: typeof allVenues[0]) => {
    const newAssignment = {
      id: `av-${Date.now()}`,
      venueId: venue.id,
      name: venue.name,
      state: venue.state,
      city: venue.city,
      assignedDate: new Date().toISOString().split('T')[0],
      upcomingEvents: venue.upcomingEvents,
    };
    setAssignedVenues([...assignedVenues, newAssignment]);
    setIsAddDialogOpen(false);
    toast.success(`${venue.name} assigned to staff member`);
  };

  const handleRemoveVenue = (assignmentId: string) => {
    setAssignedVenues(assignedVenues.filter(v => v.id !== assignmentId));
    toast.success('Venue assignment removed');
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
          <h1 className="text-2xl font-bold">Venue Assignments</h1>
          <p className="text-muted-foreground">Manage venue assignments for {staffName}</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-500">
              <Plus className="h-4 w-4 mr-2" />
              Assign Venue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign New Venue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search venues..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {availableVenues.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No available venues found</p>
                ) : (
                  availableVenues.map(venue => (
                    <Card 
                      key={venue.id} 
                      className="border-border/50 hover:border-pink-500/30 cursor-pointer transition-colors"
                      onClick={() => handleAssignVenue(venue)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <Building className="h-5 w-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium">{venue.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{venue.city}, {venue.state}</span>
                              <span>•</span>
                              <Users className="h-3 w-3" />
                              <span>Cap: {venue.capacity}</span>
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {simulationMode && (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          Simulation Mode - Changes won't be saved
        </Badge>
      )}

      {/* Assigned Venues */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-pink-500" />
            Assigned Venues ({assignedVenues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignedVenues.length === 0 ? (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Venues Assigned</h3>
              <p className="text-muted-foreground mb-4">
                Assign venues to this staff member to track their work locations.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Assign First Venue
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedVenues.map(venue => (
                <Card key={venue.id} className="border-border/30">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10">
                        <Building className="h-6 w-6 text-pink-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{venue.name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.city}, {venue.state}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Assigned: {new Date(venue.assignedDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {venue.upcomingEvents > 0 && (
                        <Badge variant="secondary">
                          {venue.upcomingEvents} upcoming event{venue.upcomingEvents > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveVenue(venue.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
