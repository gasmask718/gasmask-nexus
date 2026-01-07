import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, startOfMonth, endOfMonth, isToday, isPast } from 'date-fns';
import { FollowUpDateList } from './FollowUpDateList';
import { ExportToRouteButton } from './ExportToRouteButton';
import { cn } from '@/lib/utils';

export interface CalendarFollowUp {
  id: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  dueAt: Date;
  reason: string;
  actionType: string;
}

interface FollowUpCalendarViewProps {
  followUps: CalendarFollowUp[];
  isLoading?: boolean;
}

export const FollowUpCalendarView = ({ followUps, isLoading }: FollowUpCalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Group follow-ups by date
  const followUpsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarFollowUp[]>();
    followUps.forEach(fu => {
      const dateKey = format(fu.dueAt, 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(fu);
    });
    return grouped;
  }, [followUps]);

  // Get dates that have follow-ups
  const datesWithFollowUps = useMemo(() => {
    return Array.from(followUpsByDate.keys()).map(dateStr => new Date(dateStr));
  }, [followUpsByDate]);

  // Get follow-ups for selected date
  const selectedDateFollowUps = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return followUpsByDate.get(dateKey) || [];
  }, [selectedDate, followUpsByDate]);

  // Custom day rendering
  const modifiers = useMemo(() => {
    const overdueDates: Date[] = [];
    const todayDates: Date[] = [];
    const upcomingDates: Date[] = [];

    datesWithFollowUps.forEach(date => {
      if (isToday(date)) {
        todayDates.push(date);
      } else if (isPast(date)) {
        overdueDates.push(date);
      } else {
        upcomingDates.push(date);
      }
    });

    return {
      overdue: overdueDates,
      dueToday: todayDates,
      upcoming: upcomingDates,
    };
  }, [datesWithFollowUps]);

  const modifiersStyles = {
    overdue: {
      backgroundColor: 'hsl(var(--destructive) / 0.15)',
      borderRadius: '50%',
    },
    dueToday: {
      backgroundColor: 'hsl(45, 93%, 47%, 0.2)',
      borderRadius: '50%',
    },
    upcoming: {
      backgroundColor: 'hsl(var(--primary) / 0.15)',
      borderRadius: '50%',
    },
  };

  const selectedStoreIds = useMemo(() => {
    return selectedDateFollowUps
      .filter(f => selectedIds.has(f.id))
      .map(f => f.storeId)
      .filter((id, index, self) => self.indexOf(id) === index);
  }, [selectedDateFollowUps, selectedIds]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <Card className="p-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="rounded-md w-full"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4 w-full",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-lg font-semibold",
            nav: "space-x-1 flex items-center",
            nav_button: "h-10 w-10 bg-transparent p-0 opacity-50 hover:opacity-100",
            table: "w-full border-collapse space-y-1",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.9rem]",
            row: "flex w-full mt-2",
            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 w-full h-12",
            day: "h-12 w-12 p-0 font-normal text-base aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-full mx-auto flex items-center justify-center",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground font-bold",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-50",
          }}
        />
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive/30" />
            <span className="text-sm text-muted-foreground">Overdue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500/30" />
            <span className="text-sm text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary/30" />
            <span className="text-sm text-muted-foreground">Upcoming</span>
          </div>
        </div>
      </Card>

      {/* Selected Date Info */}
      {selectedDate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <Badge variant="outline" className="text-base px-3 py-1">
              {selectedDateFollowUps.length} Follow-ups
            </Badge>
          </div>

          <FollowUpDateList
            followUps={selectedDateFollowUps}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />

          {selectedDateFollowUps.length > 0 && (
            <ExportToRouteButton
              storeIds={selectedStoreIds.length > 0 ? selectedStoreIds : selectedDateFollowUps.map(f => f.storeId).filter((id, i, self) => self.indexOf(id) === i)}
              followUpDate={selectedDate}
            />
          )}
        </div>
      )}
    </div>
  );
};
