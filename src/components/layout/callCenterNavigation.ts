import { Phone, Brain, FileText, MessageSquare, Mail, Settings, Activity } from 'lucide-react';

export const callCenterNavItems = [
  { to: '/callcenter', icon: Phone, label: 'Dashboard', roles: ['admin'] },
  { to: '/callcenter/numbers', icon: Phone, label: 'Phone Numbers', roles: ['admin'] },
  { to: '/callcenter/ai-agents', icon: Brain, label: 'AI Agents', roles: ['admin'] },
  { to: '/callcenter/logs', icon: FileText, label: 'Call Logs', roles: ['admin'] },
  { to: '/callcenter/live-monitoring', icon: Activity, label: 'Live Monitoring', roles: ['admin'] },
  { to: '/callcenter/messages', icon: MessageSquare, label: 'Text Messages', roles: ['admin'] },
  { to: '/callcenter/emails', icon: Mail, label: 'Email Center', roles: ['admin'] },
  { to: '/callcenter/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];
