import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Phone, PhoneCall, PhoneOff, Clock, User, Loader2, Plus
} from "lucide-react";
import { useStaffMember } from '@/hooks/useUnforgettableStaff';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CallLog {
  id: string;
  direction: 'outbound' | 'inbound';
  duration: string;
  outcome: 'answered' | 'voicemail' | 'no_answer' | 'busy';
  notes: string;
  createdAt: string;
  caller: string;
}

const generateMockCallLogs = (): CallLog[] => [
  {
    id: 'c1',
    direction: 'outbound',
    duration: '4:23',
    outcome: 'answered',
    notes: 'Confirmed availability for upcoming event on Feb 15th. Will arrive at 2pm for setup.',
    createdAt: '2024-01-22T10:30:00Z',
    caller: 'Sarah Johnson',
  },
  {
    id: 'c2',
    direction: 'outbound',
    duration: '0:45',
    outcome: 'voicemail',
    notes: 'Left voicemail about schedule changes for next week.',
    createdAt: '2024-01-18T15:45:00Z',
    caller: 'Mike Wilson',
  },
  {
    id: 'c3',
    direction: 'inbound',
    duration: '6:12',
    outcome: 'answered',
    notes: 'Staff called to request time off for March 5-10. Approved pending coverage.',
    createdAt: '2024-01-15T09:20:00Z',
    caller: 'Staff Member',
  },
];

export default function UnforgettableStaffCall() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const { simulationMode } = useSimulationMode();
  const { data: staffMember, isLoading } = useStaffMember(staffId);
  
  const [callLogs, setCallLogs] = useState<CallLog[]>(generateMockCallLogs());
  const [isLogging, setIsLogging] = useState(false);
  const [callOutcome, setCallOutcome] = useState<string>('answered');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState('');

  const handleInitiateCall = () => {
    if (staffMember?.phone) {
      window.open(`tel:${staffMember.phone}`, '_self');
      setIsLogging(true);
      toast.info('Call initiated - log your call after completion');
    } else {
      toast.error('No phone number available');
    }
  };

  const handleLogCall = () => {
    if (!callDuration.trim()) {
      toast.error('Please enter call duration');
      return;
    }

    const newLog: CallLog = {
      id: `c-${Date.now()}`,
      direction: 'outbound',
      duration: callDuration,
      outcome: callOutcome as CallLog['outcome'],
      notes: callNotes,
      createdAt: new Date().toISOString(),
      caller: 'Current User',
    };

    setCallLogs([newLog, ...callLogs]);
    setIsLogging(false);
    setCallDuration('');
    setCallNotes('');
    setCallOutcome('answered');
    toast.success('Call logged successfully');
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'answered':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'voicemail':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'no_answer':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'busy':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
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
      <div>
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/os/unforgettable/staff/${staffId}`)}
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Button>
        <h1 className="text-2xl font-bold">Call {staffName}</h1>
        <p className="text-muted-foreground">Initiate calls and view call history</p>
      </div>

      {simulationMode && (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          Simulation Mode - Calls will use device dialer
        </Badge>
      )}

      {/* Contact Card */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                <Phone className="h-8 w-8 text-pink-500" />
              </div>
              <div>
                <p className="text-lg font-semibold">{staffName}</p>
                <p className="text-xl font-mono text-muted-foreground">
                  {staffMember?.phone || 'No phone number'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              {!isLogging && (
                <Button 
                  onClick={() => setIsLogging(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log Call
                </Button>
              )}
              <Button 
                onClick={handleInitiateCall}
                disabled={!staffMember?.phone}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
                size="lg"
              >
                <PhoneCall className="h-5 w-5 mr-2" />
                Call Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Call Form */}
      {isLogging && (
        <Card className="border-border/50 border-pink-500/30">
          <CardHeader>
            <CardTitle className="text-base">Log Call</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <input
                  type="text"
                  placeholder="e.g., 5:30"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Outcome</label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="answered">Answered</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="What was discussed..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsLogging(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogCall}>
                Save Call Log
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call History */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-pink-500" />
            Call History ({callLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callLogs.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Call History</h3>
              <p className="text-muted-foreground">
                Call logs will appear here after you make or receive calls.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {callLogs.map(log => (
                <Card key={log.id} className="border-border/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${log.direction === 'outbound' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                          {log.direction === 'outbound' ? (
                            <PhoneCall className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Phone className="h-4 w-4 text-purple-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{log.direction} Call</span>
                            <Badge variant="outline" className={getOutcomeBadge(log.outcome)}>
                              {log.outcome.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {log.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.caller}
                            </span>
                            <span>{format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {log.notes && (
                      <p className="text-sm text-muted-foreground mt-2 pl-11">{log.notes}</p>
                    )}
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
