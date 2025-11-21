import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  storeCounts: Record<string, number>;
}

const filters = [
  { value: 'all', label: 'All', color: 'text-foreground' },
  { value: 'active', label: 'Active', color: 'text-green-500' },
  { value: 'prospect', label: 'Prospect', color: 'text-yellow-500' },
  { value: 'needsFollowUp', label: 'Follow Up', color: 'text-orange-500' },
  { value: 'inactive', label: 'Inactive', color: 'text-gray-500' },
];

export const FilterBar = ({ activeFilter, onFilterChange, storeCounts }: FilterBarProps) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        const count = filter.value === 'all' 
          ? Object.values(storeCounts).reduce((sum, c) => sum + c, 0)
          : storeCounts[filter.value] || 0;

        return (
          <Button
            key={filter.value}
            variant={activeFilter === filter.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.value)}
            className={cn(
              'transition-all duration-200',
              activeFilter === filter.value 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'hover:bg-secondary/50'
            )}
          >
            <span className={cn('font-medium', filter.color)}>
              {filter.label}
            </span>
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs font-semibold">
              {count}
            </span>
          </Button>
        );
      })}
    </div>
  );
};
