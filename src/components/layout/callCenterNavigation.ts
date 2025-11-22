import { Phone, Mic, FileText, MessageSquare, Mail, Settings, Brain, PhoneCall, CheckSquare } from 'lucide-react';

export const callCenterNavItems = [
  { to: '/callcenter', icon: Phone, label: 'Dashboard', roles: ['admin'] },
  { to: '/callcenter/numbers', icon: Phone, label: 'Phone Numbers', roles: ['admin'] },
  { to: '/callcenter/logs', icon: Phone, label: 'Call Logs', roles: ['admin'] },
  { to: '/callcenter/recordings', icon: Mic, label: 'Recordings', roles: ['admin'] },
  { to: '/callcenter/transcripts', icon: FileText, label: 'Transcripts', roles: ['admin'] },
  { to: '/callcenter/messages', icon: MessageSquare, label: 'Text Messages', roles: ['admin'] },
  { to: '/callcenter/emails', icon: Mail, label: 'Email Center', roles: ['admin'] },
  { to: '/callcenter/routing', icon: Settings, label: 'Smart Routing', roles: ['admin'] },
  { to: '/callcenter/agents', icon: Brain, label: 'AI Agents', roles: ['admin'] },
  { to: '/callcenter/dialer', icon: PhoneCall, label: 'Outbound Dialer', roles: ['admin'] },
  { to: '/callcenter/tasks', icon: CheckSquare, label: 'Call Tasks', roles: ['admin'] },
  { to: '/callcenter/settings', icon: Settings, label: 'Department Settings', roles: ['admin'] },
];
