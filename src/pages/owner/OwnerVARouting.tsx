import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserPlus, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const vaTeam = [
  { id: 'va-1', name: 'Maria S.', specialty: 'CRM & Follow-ups', status: 'Available', tasksToday: 12 },
  { id: 'va-2', name: 'James K.', specialty: 'Data Entry & Admin', status: 'Busy', tasksToday: 8 },
  { id: 'va-3', name: 'Sarah L.', specialty: 'Communications', status: 'Available', tasksToday: 15 },
  { id: 'va-4', name: 'David M.', specialty: 'Research & Analysis', status: 'Offline', tasksToday: 0 },
];

const pendingAssignments = [
  { id: 1, task: 'Follow up on Funding SLA breach', priority: 'High', system: 'Funding Company' },
  { id: 2, task: 'Verify TopTier payment confirmations', priority: 'Medium', system: 'TopTier' },
  { id: 3, task: 'Reactivate dormant ambassadors', priority: 'Medium', system: 'GasMask' },
];

export default function OwnerVARouting() {
  const navigate = useNavigate();

  const handleAssign = (task: string) => {
    toast.success('Task assigned', {
      description: `"${task}" has been queued for VA assignment.`
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/os/owner')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/30">
            <Users className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">VA Routing Center</h1>
            <p className="text-sm text-muted-foreground">Manage VA assignments</p>
          </div>
        </div>
      </div>

      {/* VA Team */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-teal-400" />
            VA Team
          </CardTitle>
          <CardDescription className="text-xs">Current availability and workload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {vaTeam.map((va) => (
              <div key={va.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-teal-400">{va.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div>
                    <p className="font-medium">{va.name}</p>
                    <p className="text-xs text-muted-foreground">{va.specialty}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{va.tasksToday} tasks today</span>
                  <Badge variant="outline" className={
                    va.status === 'Available' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    va.status === 'Busy' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    'bg-muted text-muted-foreground border-border'
                  }>
                    {va.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Assignments */}
      <Card className="rounded-xl border-teal-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-400" />
            Pending Assignments
          </CardTitle>
          <CardDescription className="text-xs">Tasks waiting for VA assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingAssignments.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div>
                  <p className="font-medium text-sm">{item.task}</p>
                  <p className="text-xs text-muted-foreground">{item.system}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    item.priority === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }>
                    {item.priority}
                  </Badge>
                  <Button size="sm" onClick={() => handleAssign(item.task)}>
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate('/os/owner')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Owner Dashboard
      </Button>
    </div>
  );
}
