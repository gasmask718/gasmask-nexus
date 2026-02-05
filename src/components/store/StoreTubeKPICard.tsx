 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
 import { Package, RefreshCw, ShoppingCart, FlaskConical, Gift, Calendar, AlertTriangle } from 'lucide-react';
 import { useStoreTubeKPI, getColorStatusClasses, TUBE_KPI_BRAND_COLORS, StoreTubeKPIRow } from '@/hooks/useStoreTubeKPI';
 import { cn } from '@/lib/utils';
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // STORE TUBE KPI CARD
 // Displays ALL tube inventory products with:
 //   - Tube count per product
 //   - Last order date per product (or "Never ordered")
 //   - Color flow logic: 🟢 Green (ordered+stock) | 🟡 Yellow (never ordered) | 🔴 Red (no stock)
 // ═══════════════════════════════════════════════════════════════════════════════
 
 interface StoreTubeKPICardProps {
   storeId: string;
   compact?: boolean;
 }
 
 export function StoreTubeKPICard({ storeId, compact = false }: StoreTubeKPICardProps) {
   const { data: kpiData, isLoading, refetch, error } = useStoreTubeKPI(storeId);
 
   const totalTubes = kpiData?.reduce((sum, item) => sum + (item.tube_count || 0), 0) || 0;
   const hasActionFlags = kpiData?.some(item => item.needs_order || item.bring_samples || item.bring_starter_kit);
 
   if (isLoading) {
     return (
       <Card className="glass-card border-border/50">
         <CardContent className="flex items-center justify-center py-8">
           <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
         </CardContent>
       </Card>
     );
   }
 
   if (error) {
     return (
       <Card className="glass-card border-border/50">
         <CardContent className="flex items-center justify-center py-8 text-destructive">
           <AlertTriangle className="h-5 w-5 mr-2" />
           Failed to load tube KPI
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card className="glass-card border-border/50">
       <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
         <CardTitle className="flex items-center gap-2 text-lg">
           <Package className="h-5 w-5 text-primary" />
           Tube Intelligence
           {hasActionFlags && (
             <Badge variant="destructive" className="ml-2 text-xs animate-pulse">
               Action Required
             </Badge>
           )}
         </CardTitle>
         <Button
           variant="ghost"
           size="icon"
           onClick={() => refetch()}
           className="h-8 w-8"
         >
           <RefreshCw className="h-4 w-4" />
         </Button>
       </CardHeader>
       <CardContent className="space-y-3">
         {/* Total summary */}
         <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
           <span className="font-medium">Total Tubes</span>
           <span className="text-2xl font-bold text-primary font-mono">{totalTubes.toLocaleString()}</span>
         </div>
 
         {/* Brand breakdown with tube count + last order */}
         {kpiData && kpiData.length > 0 ? (
           <div className="space-y-2">
             {kpiData.map((item) => (
               <TubeKPIRow key={`${item.store_id}-${item.brand_id}`} item={item} compact={compact} />
             ))}
           </div>
         ) : (
           <p className="text-sm text-muted-foreground text-center py-4">
             No tube inventory data for this store
           </p>
         )}
 
         {/* Color legend */}
         {!compact && (
           <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground border-t border-border/50">
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-green-500" />
               <span>In stock + ordered</span>
             </div>
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-amber-500" />
               <span>In stock, never ordered</span>
             </div>
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-red-500" />
               <span>Out of stock</span>
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }
 
 // ═══════════════════════════════════════════════════════════════════════════════
 // INDIVIDUAL KPI ROW
 // ═══════════════════════════════════════════════════════════════════════════════
 
 interface TubeKPIRowProps {
   item: StoreTubeKPIRow;
   compact?: boolean;
 }
 
 function TubeKPIRow({ item, compact }: TubeKPIRowProps) {
   const colorClasses = getColorStatusClasses(item.color_status);
   const brandColor = TUBE_KPI_BRAND_COLORS[item.brand_id] || '#6366F1';
   const hasFlags = item.needs_order || item.bring_samples || item.bring_starter_kit;
 
   return (
     <div
       className={cn(
         'p-3 rounded-lg border transition-colors',
         hasFlags ? 'bg-orange-500/10 border-orange-500/30' : colorClasses.bg,
         hasFlags ? 'border-orange-500/30' : colorClasses.border
       )}
     >
       {/* Brand Header Row */}
       <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-2">
           <div
             className={cn('h-3 w-3 rounded-full', colorClasses.dot)}
             style={{ backgroundColor: brandColor }}
           />
           <span className="font-medium" style={{ color: brandColor }}>
             {item.brand_name}
           </span>
         </div>
         
         {/* Tube count badge */}
         <Badge 
           variant={item.tube_count === 0 ? 'destructive' : item.tube_count < 20 ? 'secondary' : 'default'}
           className="font-mono"
         >
           {item.tube_count} tubes
         </Badge>
       </div>
 
       {/* Last Order Info */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-1 text-xs text-muted-foreground">
           <Calendar className="h-3 w-3" />
           <span>
             Last Order: {' '}
             <span className={cn(
               item.last_order_date ? 'text-foreground' : 'text-amber-500 font-medium'
             )}>
               {item.last_order_label}
             </span>
           </span>
         </div>
 
         {/* Action flags */}
         {hasFlags && !compact && (
           <div className="flex items-center gap-1">
             {item.needs_order && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger>
                     <ShoppingCart className="h-4 w-4 text-red-500" />
                   </TooltipTrigger>
                   <TooltipContent>Needs Order</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
             {item.bring_samples && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger>
                     <FlaskConical className="h-4 w-4 text-purple-500" />
                   </TooltipTrigger>
                   <TooltipContent>Bring Samples</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
             {item.bring_starter_kit && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger>
                     <Gift className="h-4 w-4 text-amber-500" />
                   </TooltipTrigger>
                   <TooltipContent>Bring Starter Kit</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
             )}
           </div>
         )}
       </div>
     </div>
   );
 }