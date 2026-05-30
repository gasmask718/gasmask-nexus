import { useState } from 'react';
import { useSecurityEvents } from '@/hooks/useSecurityEvents';
import { usePortalSecurityAdmin } from '@/hooks/usePortalSecurityAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phase5Dashboard } from './Phase5Dashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Smartphone,
  LogOut,
  Snowflake,
  Check,
  RefreshCw,
  Search,
  Brain,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

/**
 * Security Console - Core OS Component
 * Provides visibility and controls for portal security events,
 * device management, and emergency controls.
 */
export function SecurityConsole() {
  const { events, isLoading, fetchEvents, acknowledgeEvent, getEventCounts } = useSecurityEvents();
  const { forceLogout, freezePortalAccess, revokeDevice, isLoading: adminLoading } = usePortalSecurityAdmin();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'logout' | 'freeze' | 'revoke' | null>(null);

  const counts = getEventCounts();

  const filteredEvents = events.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.event_type.toLowerCase().includes(query) ||
      event.event_message.toLowerCase().includes(query) ||
      event.user_id?.toLowerCase().includes(query)
    );
  });

  const handleAction = async () => {
    if (!selectedUserId || !actionType) return;

    let success = false;
    switch (actionType) {
      case 'logout':
        success = await forceLogout(selectedUserId, actionReason || undefined);
        break;
      case 'freeze':
        success = await freezePortalAccess(selectedUserId, actionReason || 'Security concern');
        break;
      case 'revoke':
        success = await revokeDevice(selectedUserId, actionReason || undefined);
        break;
    }

    if (success) {
      toast.success(`Action completed: ${actionType}`);
      setDialogOpen(false);
      setActionReason('');
      setSelectedUserId(null);
      setActionType(null);
      fetchEvents();
    } else {
      toast.error('Action failed');
    }
  };

  const handleAcknowledge = async (eventId: string) => {
    const success = await acknowledgeEvent(eventId);
    if (success) {
      toast.success('Event acknowledged');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ShieldAlert className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Security Console</h1>
            <p className="text-muted-foreground">Portal security monitoring & emergency controls</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => fetchEvents()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Events</span>
              <Badge variant="outline">{counts.total}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={counts.critical > 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-destructive">Critical</span>
              <Badge variant="destructive">{counts.critical}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={counts.warning > 0 ? 'border-yellow-500' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-600">Warnings</span>
              <Badge className="bg-yellow-500">{counts.warning}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Info</span>
              <Badge variant="secondary">{counts.info}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={counts.unacknowledged > 0 ? 'border-primary' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary">Unacknowledged</span>
              <Badge>{counts.unacknowledged}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="controls">Emergency Controls</TabsTrigger>
          <TabsTrigger value="phase5" className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            Phase 5
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Events Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{getSeverityIcon(event.severity)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-sm text-muted-foreground">{event.event_message}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.portal_type ? (
                          <Badge variant="outline" className="capitalize">
                            {event.portal_type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {event.acknowledged_at ? (
                          <Badge variant="outline" className="text-green-600">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Ack'd
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!event.acknowledged_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAcknowledge(event.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No security events found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Emergency Controls
              </CardTitle>
              <CardDescription>
                Use these controls to immediately respond to security threats.
                All actions are logged and auditable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Force Logout */}
                <Card className="border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      Force Logout
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Immediately terminate all active sessions for a user.
                    </p>
                    <Dialog open={dialogOpen && actionType === 'logout'} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setActionType('logout')}
                        >
                          Force Logout User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Force Logout User</DialogTitle>
                          <DialogDescription>
                            Enter the user ID and an optional reason for the forced logout.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            placeholder="User ID (UUID)"
                            value={selectedUserId || ''}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                          />
                          <Textarea
                            placeholder="Reason (optional)"
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleAction}
                            disabled={!selectedUserId || adminLoading}
                          >
                            Force Logout
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Freeze Access */}
                <Card className="border-2 border-destructive/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <Snowflake className="h-4 w-4" />
                      Freeze Portal Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Block all portal access for a user until manually restored.
                    </p>
                    <Dialog open={dialogOpen && actionType === 'freeze'} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => setActionType('freeze')}
                        >
                          Freeze Access
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Freeze Portal Access</DialogTitle>
                          <DialogDescription>
                            This will immediately block all portal access for the user.
                            A reason is required.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            placeholder="User ID (UUID)"
                            value={selectedUserId || ''}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                          />
                          <Textarea
                            placeholder="Reason (required)"
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                            required
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleAction}
                            disabled={!selectedUserId || !actionReason || adminLoading}
                          >
                            Freeze Access
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Revoke Device */}
                <Card className="border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Revoke Device
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Permanently revoke a specific device's access.
                    </p>
                    <Dialog open={dialogOpen && actionType === 'revoke'} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setActionType('revoke')}
                        >
                          Revoke Device
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Revoke Device</DialogTitle>
                          <DialogDescription>
                            Enter the device ID to permanently revoke access.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            placeholder="Device ID (UUID)"
                            value={selectedUserId || ''}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                          />
                          <Textarea
                            placeholder="Reason (optional)"
                            value={actionReason}
                            onChange={(e) => setActionReason(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleAction}
                            disabled={!selectedUserId || adminLoading}
                          >
                            Revoke Device
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phase 5 Shadow Mode Tab */}
        <TabsContent value="phase5">
          <Phase5Dashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
