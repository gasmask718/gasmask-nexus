import { MoreHorizontal, Edit, Trash2, Eye, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ActionType = 'view' | 'edit' | 'delete' | 'activate' | 'deactivate' | 'open';

export interface RowAction {
  type: ActionType;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface TableRowActionsProps {
  actions: RowAction[];
  label?: string;
}

const actionIcons: Record<ActionType, React.ReactNode> = {
  view: <Eye className="h-4 w-4" />,
  edit: <Edit className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  activate: <CheckCircle className="h-4 w-4" />,
  deactivate: <XCircle className="h-4 w-4" />,
  open: <ExternalLink className="h-4 w-4" />,
};

const actionLabels: Record<ActionType, string> = {
  view: 'View Details',
  edit: 'Edit',
  delete: 'Delete',
  activate: 'Activate',
  deactivate: 'Deactivate',
  open: 'Open',
};

export function TableRowActions({ actions, label = "Actions" }: TableRowActionsProps) {
  if (actions.length === 0) return null;

  // If only one or two non-destructive actions, show inline buttons
  const inlineActions = actions.filter(a => !a.destructive && a.type !== 'delete');
  if (actions.length <= 2 && inlineActions.length === actions.length) {
    return (
      <div className="flex items-center gap-1">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-8 w-8"
          >
            {actionIcons[action.type]}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action, i) => (
          <DropdownMenuItem
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className={action.destructive || action.type === 'delete' ? 'text-destructive focus:text-destructive' : ''}
          >
            <span className="mr-2">{actionIcons[action.type]}</span>
            {action.label || actionLabels[action.type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
