import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, Mail, Send, Clock, User, Loader2, FileText, Inbox, MailOpen
} from "lucide-react";
import { useStaffMember } from '@/hooks/useUnforgettableStaff';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  subject: string;
  preview: string;
  status: 'sent' | 'delivered' | 'opened' | 'failed';
  createdAt: string;
  sender: string;
}

const EMAIL_TEMPLATES = [
  { id: 'none', name: 'No Template', subject: '', body: '' },
  { id: 'schedule', name: 'Schedule Confirmation', subject: 'Event Schedule Confirmation', body: 'Hi [Name],\n\nThis is to confirm your schedule for the upcoming event:\n\n[Event Details]\n\nPlease confirm your availability.\n\nBest regards' },
  { id: 'reminder', name: 'Event Reminder', subject: 'Reminder: Upcoming Event', body: 'Hi [Name],\n\nThis is a friendly reminder about your upcoming assignment:\n\n[Event Details]\n\nPlease arrive on time.\n\nThank you!' },
  { id: 'payroll', name: 'Payroll Update', subject: 'Payroll Processed', body: 'Hi [Name],\n\nYour recent payroll has been processed.\n\n[Payment Details]\n\nIf you have any questions, please reach out.\n\nBest regards' },
  { id: 'feedback', name: 'Performance Feedback', subject: 'Event Feedback', body: 'Hi [Name],\n\nThank you for your excellent work at the recent event.\n\n[Feedback]\n\nWe appreciate your dedication!\n\nBest regards' },
];

const generateMockEmailLogs = (): EmailLog[] => [
  {
    id: 'e1',
    subject: 'Event Schedule Confirmation - Garcia Wedding',
    preview: 'Hi Maria, This is to confirm your schedule for the upcoming Garcia Wedding on Feb 15th...',
    status: 'opened',
    createdAt: '2024-01-22T10:30:00Z',
    sender: 'Sarah Johnson',
  },
  {
    id: 'e2',
    subject: 'Payroll Processed - January 2024',
    preview: 'Hi Maria, Your payroll for January has been processed. Total: $1,850...',
    status: 'delivered',
    createdAt: '2024-01-25T14:00:00Z',
    sender: 'Payroll System',
  },
  {
    id: 'e3',
    subject: 'Reminder: Training Session Tomorrow',
    preview: 'Hi Maria, Just a reminder about the food safety training session tomorrow at 2pm...',
    status: 'sent',
    createdAt: '2024-01-14T16:45:00Z',
    sender: 'Mike Wilson',
  },
];

export default function UnforgettableStaffEmail() {
  const navigate = useNavigate();
  const { staffId } = useParams<{ staffId: string }>();
  const { simulationMode } = useSimulationMode();
  const { data: staffMember, isLoading } = useStaffMember(staffId);
  
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(generateMockEmailLogs());
  const [isComposing, setIsComposing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('none');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBody(template.body.replace('[Name]', staffMember?.first_name || 'there'));
    }
  };

  const handleSendEmail = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newEmail: EmailLog = {
      id: `e-${Date.now()}`,
      subject,
      preview: body.slice(0, 100) + '...',
      status: 'sent',
      createdAt: new Date().toISOString(),
      sender: 'Current User',
    };

    setEmailLogs([newEmail, ...emailLogs]);
    setIsComposing(false);
    setSubject('');
    setBody('');
    setSelectedTemplate('none');
    setIsSending(false);
    toast.success('Email sent successfully');
  };

  const handleOpenMailClient = () => {
    if (staffMember?.email) {
      window.open(`mailto:${staffMember.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'delivered':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'opened':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
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
          <h1 className="text-2xl font-bold">Email {staffName}</h1>
          <p className="text-muted-foreground">
            {staffMember?.email || 'No email address on file'}
          </p>
        </div>
        
        {!isComposing && (
          <Button 
            onClick={() => setIsComposing(true)}
            disabled={!staffMember?.email}
            className="bg-gradient-to-r from-pink-600 to-purple-500"
          >
            <Mail className="h-4 w-4 mr-2" />
            Compose Email
          </Button>
        )}
      </div>

      {simulationMode && (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          Simulation Mode - Emails will be logged locally
        </Badge>
      )}

      {/* No Email Warning */}
      {!staffMember?.email && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-600">No Email Address</p>
              <p className="text-sm text-muted-foreground">
                This staff member doesn't have an email address on file. 
                <Button 
                  variant="link" 
                  className="px-1 h-auto text-pink-600"
                  onClick={() => navigate(`/os/unforgettable/staff/${staffId}/edit`)}
                >
                  Add one now
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compose Email */}
      {isComposing && (
        <Card className="border-border/50 border-pink-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Compose Email</span>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Use template" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATES.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">To:</span>
              <span className="font-medium">{staffMember?.email}</span>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                placeholder="Email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Write your message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
            
            <div className="flex gap-2 justify-between">
              <Button 
                variant="outline" 
                onClick={handleOpenMailClient}
                disabled={!staffMember?.email}
              >
                <Mail className="h-4 w-4 mr-2" />
                Open in Email Client
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setIsComposing(false); setSubject(''); setBody(''); }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="bg-gradient-to-r from-pink-600 to-purple-500"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email History */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-pink-500" />
            Email History ({emailLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Emails Sent</h3>
              <p className="text-muted-foreground">
                Email history will appear here after you send emails.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailLogs.map(email => (
                <Card key={email.id} className="border-border/30 hover:border-pink-500/20 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${email.status === 'opened' ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                          {email.status === 'opened' ? (
                            <MailOpen className="h-4 w-4 text-purple-500" />
                          ) : (
                            <Mail className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{email.subject}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {email.sender}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(email.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusBadge(email.status)}>
                        {email.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11 line-clamp-2">{email.preview}</p>
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
