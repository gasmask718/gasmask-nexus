import { Phone, MessageSquare, Mail, Bot, Hash, FileText, BarChart3, Settings, Megaphone } from 'lucide-react';

export const communicationNavItems = [
  { to: '/communication', icon: BarChart3, label: 'Overview', roles: ['admin', 'csr'] },
  { to: '/communication/campaigns', icon: Megaphone, label: 'Campaigns', roles: ['admin', 'manager'] },
  { to: '/communication/calls', icon: Phone, label: 'Calls', roles: ['admin', 'csr'] },
  { to: '/communication/sms', icon: MessageSquare, label: 'SMS', roles: ['admin', 'csr'] },
  { to: '/communication/email', icon: Mail, label: 'Email', roles: ['admin', 'csr'] },
  { to: '/communication/ai-agents', icon: Bot, label: 'AI Agents', roles: ['admin'] },
  { to: '/communication/numbers', icon: Hash, label: 'Phone Numbers', roles: ['admin'] },
  { to: '/communication/logs', icon: FileText, label: 'All Logs', roles: ['admin', 'csr'] },
  { to: '/communication/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin'] },
  { to: '/communication/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
];
