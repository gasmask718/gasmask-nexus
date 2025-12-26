import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageSquare,
  Send,
  Bell,
  Users,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Megaphone,
  Mail,
  Phone,
  MessageCircle
} from 'lucide-react';

// Mock announcements
const mockAnnouncements = [
  { id: '1', title: 'New Year\'s Eve Event Briefing', content: 'All staff assigned to NYE events please review the updated protocols...', date: '2024-01-15', priority: 'high', readBy: 18, totalStaff: 25 },
  { id: '2', title: 'Updated Uniform Guidelines', content: 'Please note the updated dress code requirements for formal events...', date: '2024-01-12', priority: 'medium', readBy: 22, totalStaff: 25 },
  { id: '3', title: 'January Schedule Released', content: 'The January event schedule has been published. Please check your assignments...', date: '2024-01-08', priority: 'low', readBy: 25, totalStaff: 25 },
  { id: '4', title: 'Safety Training Reminder', content: 'All staff must complete the updated safety training by end of month...', date: '2024-01-05', priority: 'high', readBy: 15, totalStaff: 25 },
];

// Mock messages
const mockMessages = [
  { id: '1', from: 'Marcus Johnson', to: 'Management', subject: 'Equipment Request', preview: 'I need to request new DJ equipment for...', date: '2024-01-20', status: 'unread' },
  { id: '2', from: 'Sarah Chen', to: 'Management', subject: 'Schedule Conflict', preview: 'I have a scheduling conflict for the...', date: '2024-01-19', status: 'read' },
  { id: '3', from: 'Mike Torres', to: 'Management', subject: 'Training Completion', preview: 'I\'ve completed the required training...', date: '2024-01-18', status: 'replied' },
  { id: '4', from: 'Jessica Williams', to: 'Management', subject: 'Event Feedback', preview: 'Wanted to share some feedback from...', date: '2024-01-17', status: 'read' },
];

// Mock quick contacts
const mockQuickContacts = [
  { id: '1', name: 'Marcus Johnson', role: 'Lead DJ', phone: '555-0101', email: 'marcus@example.com', status: 'online' },
  { id: '2', name: 'Sarah Chen', role: 'Event Coordinator', phone: '555-0102', email: 'sarah@example.com', status: 'online' },
  { id: '3', name: 'Mike Torres', role: 'Bartender', phone: '555-0103', email: 'mike@example.com', status: 'offline' },
  { id: '4', name: 'Jessica Williams', role: 'MC/Host', phone: '555-0104', email: 'jessica@example.com', status: 'away' },
];

export default function UnforgettableCommunications() {
  const [searchTerm, setSearchTerm] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState('');

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Unread</Badge>;
      case 'read':
        return <Badge className="bg-muted text-muted-foreground">Read</Badge>;
      case 'replied':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Replied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOnlineStatus = (status: string) => {
    switch (status) {
      case 'online':
        return <div className="w-2 h-2 rounded-full bg-emerald-400" />;
      case 'away':
        return <div className="w-2 h-2 rounded-full bg-amber-400" />;
      case 'offline':
        return <div className="w-2 h-2 rounded-full bg-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff Communications</h1>
          <p className="text-muted-foreground">Send announcements, messages, and manage staff communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            <Megaphone className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <MessageSquare className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unread Messages</p>
                <p className="text-2xl font-bold text-foreground">5</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Read Rate</p>
                <p className="text-2xl font-bold text-foreground">78%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Replies</p>
                <p className="text-2xl font-bold text-foreground">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff Online</p>
                <p className="text-2xl font-bold text-foreground">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="announcements" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="contacts">Quick Contacts</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Recent Announcements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockAnnouncements.map((announcement) => (
                <div key={announcement.id} className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-primary" />
                      <h4 className="font-medium text-foreground">{announcement.title}</h4>
                    </div>
                    {getPriorityBadge(announcement.priority)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{announcement.content}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{announcement.date}</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{announcement.readBy}/{announcement.totalStaff} read</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">From</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Subject</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockMessages.map((message) => (
                    <tr key={message.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${message.status === 'unread' ? 'bg-muted/20' : ''}`}>
                      <td className="p-4">
                        <p className="font-medium text-foreground">{message.from}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-foreground">{message.subject}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{message.preview}</p>
                      </td>
                      <td className="p-4 text-center text-muted-foreground">{message.date}</td>
                      <td className="p-4 text-center">{getStatusBadge(message.status)}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockQuickContacts.map((contact) => (
              <Card key={contact.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{contact.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{contact.name}</p>
                          {getOnlineStatus(contact.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{contact.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{contact.email}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Recipients</label>
                <Select>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select recipients..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    <SelectItem value="coordinators">Event Coordinators</SelectItem>
                    <SelectItem value="djs">DJs & Entertainment</SelectItem>
                    <SelectItem value="service">Service Staff</SelectItem>
                    <SelectItem value="setup">Setup Crew</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Subject</label>
                <Input placeholder="Enter subject..." className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Message</label>
                <Textarea 
                  placeholder="Write your message..." 
                  className="bg-background border-border min-h-[150px]"
                  value={newAnnouncement}
                  onChange={(e) => setNewAnnouncement(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Select>
                    <SelectTrigger className="w-32 bg-background border-border">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="bg-primary hover:bg-primary/90">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
