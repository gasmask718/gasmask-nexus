/**
 * Mission List View — Filtered, grouped mission display
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Target, AlertTriangle, CheckCircle, Clock, Inbox } from 'lucide-react';
import { MissionCard } from './MissionCard';
import type { Mission, MissionStatus, MissionCategory } from '@/hooks/useMissionControl';

interface MissionListViewProps {
  missions: Mission[];
  onStatusChange: (id: string, status: MissionStatus) => void;
  onDelete: (id: string) => void;
}

export function MissionListView({ missions, onStatusChange, onDelete }: MissionListViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tab, setTab] = useState('active');

  const filtered = useMemo(() => {
    let result = missions;

    // Tab filter
    if (tab === 'active') result = result.filter(m => ['pending', 'in_progress', 'blocked'].includes(m.status));
    else if (tab === 'completed') result = result.filter(m => m.status === 'completed');
    else if (tab === 'deferred') result = result.filter(m => ['deferred', 'cancelled'].includes(m.status));

    // Category filter
    if (categoryFilter !== 'all') result = result.filter(m => m.category === categoryFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort: overdue first, then by priority, then by due date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    result.sort((a, b) => {
      // Overdue first
      const aOverdue = a.due_date && new Date(a.due_date) < new Date() ? -1 : 0;
      const bOverdue = b.due_date && new Date(b.due_date) < new Date() ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      // Priority
      const pA = priorityOrder[a.priority] ?? 2;
      const pB = priorityOrder[b.priority] ?? 2;
      if (pA !== pB) return pA - pB;

      // Due date
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [missions, tab, categoryFilter, search]);

  const activeCount = missions.filter(m => ['pending', 'in_progress', 'blocked'].includes(m.status)).length;
  const completedCount = missions.filter(m => m.status === 'completed').length;
  const deferredCount = missions.filter(m => ['deferred', 'cancelled'].includes(m.status)).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search missions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="strategic">🎯 Strategic</SelectItem>
            <SelectItem value="operational">⚙️ Operational</SelectItem>
            <SelectItem value="financial">💰 Financial</SelectItem>
            <SelectItem value="personal">👤 Personal</SelectItem>
            <SelectItem value="compliance">📋 Compliance</SelectItem>
            <SelectItem value="growth">🚀 Growth</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Active
            {activeCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Completed
            {completedCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{completedCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="deferred" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Deferred
            {deferredCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{deferredCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {tab === 'active' ? 'No active missions. Create one to get started.' :
                   tab === 'completed' ? 'No completed missions yet.' :
                   'No deferred or cancelled missions.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
