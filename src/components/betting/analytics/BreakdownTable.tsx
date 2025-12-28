import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BreakdownRow } from '@/hooks/useAnalyticsData';
import { FORMAT_LABELS, FormatTag, STATE_LABELS, SupportedState } from '@/hooks/useStateCompliance';

interface BreakdownTableProps {
  title: string;
  data: BreakdownRow[];
  nameFormatter?: (name: string) => string;
}

type SortKey = 'name' | 'entries' | 'winRate' | 'totalStaked' | 'totalPL' | 'roi';

export function BreakdownTable({ title, data, nameFormatter }: BreakdownTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('roi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const formatName = (name: string) => {
    if (nameFormatter) return nameFormatter(name);
    // Try to match known labels
    if (name in FORMAT_LABELS) return FORMAT_LABELS[name as FormatTag];
    if (name in STATE_LABELS) return STATE_LABELS[name as SupportedState];
    return name;
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-8">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[140px]">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('name')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  Name <SortIcon column="name" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('entries')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  Entries <SortIcon column="entries" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('winRate')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  Win% <SortIcon column="winRate" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalStaked')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  Staked <SortIcon column="totalStaked" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('totalPL')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  P/L <SortIcon column="totalPL" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('roi')}
                  className="h-auto p-0 font-medium text-xs hover:bg-transparent"
                >
                  ROI% <SortIcon column="roi" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium text-xs">{formatName(row.name)}</TableCell>
                <TableCell className="text-right text-xs">{row.entries}</TableCell>
                <TableCell className="text-right text-xs">{row.winRate.toFixed(1)}%</TableCell>
                <TableCell className="text-right text-xs">${row.totalStaked.toFixed(2)}</TableCell>
                <TableCell className={`text-right text-xs font-medium ${row.totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {row.totalPL >= 0 ? '+' : ''}${row.totalPL.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right text-xs font-medium ${row.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {row.roi >= 0 ? '+' : ''}{row.roi.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
