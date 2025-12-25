import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bike, MapPin, Eye, Route, ChevronRight } from 'lucide-react';

interface Biker {
  id: string;
  full_name: string;
  territory: string | null;
  status: string;
  tasksToday?: number;
  completedToday?: number;
}

interface ActiveBikersTableProps {
  bikers: Biker[];
  isLoading?: boolean;
  onAssignRoute?: (bikerId: string, bikerName: string) => void;
}

export const ActiveBikersTable: React.FC<ActiveBikersTableProps> = ({
  bikers,
  isLoading,
  onAssignRoute
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      on_task: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      offline: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      paused: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    };
    return styles[status] || styles.offline;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading bikers...
        </CardContent>
      </Card>
    );
  }

  if (bikers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-emerald-500" />
            Active Bikers
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No active bikers found</p>
          <Button onClick={() => navigate('/delivery/bikers')}>
            Manage Bikers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bike className="h-5 w-5 text-emerald-500" />
          Active Bikers ({bikers.length})
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/delivery/bikers')}
        >
          View All <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Biker</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Territory</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tasks Today</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bikers.map((biker) => (
                <tr 
                  key={biker.id} 
                  className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/delivery/bikers/${biker.id}`)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                        {biker.full_name.charAt(0)}
                      </div>
                      <span className="font-medium">{biker.full_name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{biker.territory || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {biker.tasksToday !== undefined && (
                        <>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-24">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                              style={{ width: `${biker.tasksToday > 0 ? ((biker.completedToday || 0) / biker.tasksToday) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {biker.completedToday || 0}/{biker.tasksToday}
                          </span>
                        </>
                      )}
                      {biker.tasksToday === undefined && (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={getStatusBadge(biker.status)}>
                      {biker.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => navigate(`/delivery/bikers/${biker.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onAssignRoute?.(biker.id, biker.full_name)}
                      >
                        <Route className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActiveBikersTable;
