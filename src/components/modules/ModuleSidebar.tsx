import { Link, useLocation } from 'react-router-dom';
import { useModules } from '@/hooks/useModules';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ModuleSidebarProps {
  className?: string;
}

/**
 * ModuleSidebar - Dynamically generates sidebar items from registered modules
 */
export function ModuleSidebar({ className }: ModuleSidebarProps) {
  const { accessibleModules } = useModules();
  const location = useLocation();
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isModuleActive = (basePath: string) => location.pathname.startsWith(basePath);

  return (
    <nav className={cn('space-y-1', className)}>
      {accessibleModules.map((module) => {
        const isExpanded = expandedModules.includes(module.config.id) || isModuleActive(module.config.basePath);
        const Icon = module.config.icon;

        return (
          <div key={module.config.id} className="space-y-1">
            {/* Module Header */}
            <button
              onClick={() => toggleModule(module.config.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isModuleActive(module.config.basePath)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{module.config.name}</span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Module Items */}
            {isExpanded && (
              <div className="ml-6 space-y-1">
                {module.sidebarItems.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                        isActive(item.path)
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default ModuleSidebar;
