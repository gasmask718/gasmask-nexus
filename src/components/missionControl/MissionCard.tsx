/**
 * Mission Card — Individual mission display with quick actions
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  Pause,
  Play,
  MoreVertical,
  Trash2,
  Building2,
  Bot,
  Users,
  Calendar,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { format, isAfter, isBefore, isToday } from 'date-fns';
import type { Mission, MissionStatus } from '@/hooks/useMissionControl';

interface MissionCardProps {
  mission: Mission;
  onStatusChange: (id: string, status: MissionStatus) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const priorityConfig = {
  low: { color: 'bg-muted text-muted-foreground', label: 'Low' },
  medium: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Medium' },
  high: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'High' },
  critical: { color: 'bg-destructive/10 text-destructive border-destructive/20', label: 'Critical' },
};

const categoryIcons: Record<string, typeof Target> = {
  strategic: Target,
  operational: ArrowRight,
  financial: Building2,
  personal: Users,
  compliance: AlertTriangle,
  growth: Flame,
};

const sourceLabels: Record<string, { label: string; icon: typeof Target }> = {
  owner_manual: { label: 'Manual', icon: Target },
  floor_generated: { label: 'Floor', icon: Building2 },
  ai_suggested: { label: 'AI', icon: Bot },
  delegated: { label: 'Delegated', icon: Users },
  recurring_auto: { label: 'Recurring', icon: Clock },
  external: { label: 'External', icon: ArrowRight },
};

export function MissionCard({ mission, onStatusChange, onDelete, compact = false }: MissionCardProps) {
  const isOverdue = mission.due_date && isBefore(new Date(mission.due_date), new Date()) && mission.status !== 'completed';
  const isDueToday = mission.due_date && isToday(new Date(mission.due_date));
  const CategoryIcon = categoryIcons[mission.category] || Target;
  const sourceInfo = sourceLabels[mission.source] || sourceLabels.owner_manual;
  const SourceIcon = sourceInfo.icon;

  const statusActions: { status: MissionStatus; label: string; icon: typeof Play }[] = [];
  if (mission.status === 'pending') {
    statusActions.push({ status: 'in_progress', label: 'Start', icon: Play });
    statusActions.push({ status: 'deferred', label: 'Defer', icon: Pause });
  }
  if (mission.status === 'in_progress') {
    statusActions.push({ status: 'completed', label: 'Complete', icon: CheckCircle });
    statusActions.push({ status: 'blocked', label: 'Block', icon: AlertTriangle });
  }
  if (mission.status === 'blocked' || mission.status === 'deferred') {
    statusActions.push({ status: 'in_progress', label: 'Resume', icon: Play });
    statusActions.push({ status: 'cancelled', label: 'Cancel', icon: Trash2 });
  }

  return (
    <Card className={`group transition-all hover:shadow-md ${isOverdue ? 'border-destructive/50' : ''} ${mission.status === 'completed' ? 'opacity-70' : ''}`}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          {/* Quick complete checkbox area */}
          <button
            onClick={() => {
              if (mission.status === 'completed') return;
              onStatusChange(mission.id, mission.status === 'in_progress' ? 'completed' : 'in_progress');
            }}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              mission.status === 'completed'
                ? 'bg-primary border-primary'
                : 'border-muted-foreground/30 hover:border-primary'
            }`}
          >
            {mission.status === 'completed' && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-medium text-sm truncate ${mission.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {mission.title}
              </h4>
            </div>

            {!compact && mission.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{mission.description}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityConfig[mission.priority].color}`}>
                {priorityConfig[mission.priority].label}
              </Badge>

              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <CategoryIcon className="h-2.5 w-2.5 mr-0.5" />
                {mission.category}
              </Badge>

              {mission.source !== 'owner_manual' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <SourceIcon className="h-2.5 w-2.5 mr-0.5" />
                  {sourceInfo.label}
                </Badge>
              )}

              {mission.businesses?.business_name && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Building2 className="h-2.5 w-2.5 mr-0.5" />
                  {mission.businesses.business_name}
                </Badge>
              )}

              {mission.due_date && (
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    isOverdue
                      ? 'bg-destructive/10 text-destructive border-destructive/30'
                      : isDueToday
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : ''
                  }`}
                >
                  <Calendar className="h-2.5 w-2.5 mr-0.5" />
                  {isOverdue ? 'Overdue: ' : ''}
                  {format(new Date(mission.due_date), 'MMM d, yyyy')}
                </Badge>
              )}

              {(mission.times_deferred || 0) > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400">
                  Deferred ×{mission.times_deferred}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {statusActions.map(({ status, label, icon: Icon }) => (
                <DropdownMenuItem key={status} onClick={() => onStatusChange(mission.id, status)}>
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
              {statusActions.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(mission.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
