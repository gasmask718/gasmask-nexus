import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Send, 
  UserPlus, 
  Target, 
  Route, 
  Bell, 
  FileText, 
  Phone, 
  Mail,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  badge?: string;
}

const quickActions: QuickAction[] = [
  { id: 'broadcast', label: 'Send Broadcast', icon: Send, path: '/os/owner/ai-command', variant: 'default' },
  { id: 'assign-va', label: 'Assign VA', icon: UserPlus, path: '/os/owner/va-routing', variant: 'secondary' },
  { id: 'crm-leads', label: 'Check Leads', icon: Target, path: '/crm', variant: 'secondary', badge: '12 new' },
  { id: 'route-ops', label: 'Route Ops', icon: Route, path: '/route-ops-center', variant: 'secondary' },
  { id: 'alerts', label: 'View Alerts', icon: Bell, path: '/os/owner/alert-center', variant: 'outline', badge: '7' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/os/owner/reports', variant: 'outline' },
  { id: 'call-center', label: 'Call Center', icon: Phone, path: '/callcenter', variant: 'outline' },
  { id: 'email-blast', label: 'Email Blast', icon: Mail, path: '/global/communications', variant: 'outline' },
];

export function QuickActionsRow() {
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    if (action.path) {
      navigate(action.path);
    } else if (action.onClick) {
      action.onClick();
    }
  };

  return (
    <Card className="rounded-xl shadow-lg border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription className="text-xs">One-click access to common tasks</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'secondary'}
              size="sm"
              className="gap-2 relative"
              onClick={() => handleAction(action)}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
              {action.badge && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                  {action.badge}
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickActionsRow;
