 import { Badge } from '@/components/ui/badge';
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
 import { Package, AlertTriangle, ShoppingCart, Calendar } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import type { StoreKPISummary } from '@/hooks/useStoreTubeKPIBatch';
 import { getStoreKPIStatusColor } from '@/hooks/useStoreTubeKPIBatch';
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // STORE KPI BADGE (COMPACT)
 // Displays tube KPI summary inline on Store Directory cards
 // ═══════════════════════════════════════════════════════════════════════════════
 
 interface StoreKPIBadgeProps {
   summary: StoreKPISummary | undefined;
   isLoading?: boolean;
 }
 
 export function StoreKPIBadge({ summary, isLoading }: StoreKPIBadgeProps) {
   if (isLoading) {
     return (
       <Badge variant="outline" className="text-xs animate-pulse">
         <Package className="h-3 w-3 mr-1" />
         Loading...
       </Badge>
     );
   }
 
   // No data / not verified
   if (!summary || !summary.verified) {
     return (
       <Badge variant="outline" className="text-xs text-muted-foreground">
         <AlertTriangle className="h-3 w-3 mr-1" />
         KPI Missing
       </Badge>
     );
   }
 
   // No tube inventory records
   if (summary.brandCount === 0) {
     return (
       <Badge variant="outline" className="text-xs text-muted-foreground">
         <Package className="h-3 w-3 mr-1" />
         No tube data
       </Badge>
     );
   }
 
   const statusColor = getStoreKPIStatusColor(summary);
   const statusIcon = summary.hasOutOfStock ? (
     <AlertTriangle className="h-3 w-3" />
   ) : summary.hasNeverOrdered ? (
     <Calendar className="h-3 w-3" />
   ) : summary.needsAction ? (
     <ShoppingCart className="h-3 w-3" />
   ) : (
     <Package className="h-3 w-3" />
   );
 
   // Build tooltip content
   const tooltipContent = summary.kpiRows.slice(0, 5).map(row => (
     <div key={row.brand_id} className="flex justify-between gap-4 text-xs">
       <span>{row.brand_name}</span>
       <span className="font-mono">{row.tube_count} tubes</span>
     </div>
   ));
 
   return (
     <TooltipProvider>
       <Tooltip>
         <TooltipTrigger asChild>
           <Badge className={cn('text-xs cursor-help', statusColor)}>
             {statusIcon}
             <span className="ml-1 font-mono">{summary.totalTubes}</span>
             <span className="ml-0.5">tubes</span>
             {summary.hasOutOfStock && (
               <span className="ml-1 text-[10px]">⚠</span>
             )}
           </Badge>
         </TooltipTrigger>
         <TooltipContent side="bottom" className="max-w-xs">
           <div className="space-y-1">
             <div className="font-medium mb-2">Tube Intelligence</div>
             {tooltipContent}
             {summary.kpiRows.length > 5 && (
               <div className="text-xs text-muted-foreground">
                 +{summary.kpiRows.length - 5} more brands
               </div>
             )}
             {summary.hasNeverOrdered && (
              <div className="text-warning text-xs mt-2">
                 ⚠ Some products never ordered
               </div>
             )}
             {summary.hasOutOfStock && (
              <div className="text-destructive text-xs">
                 ⚠ Some products out of stock
               </div>
             )}
           </div>
         </TooltipContent>
       </Tooltip>
     </TooltipProvider>
   );
 }