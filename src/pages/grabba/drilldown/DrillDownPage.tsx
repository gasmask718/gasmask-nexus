import { useParams, useSearchParams } from 'react-router-dom';
import { DrillDownPanel } from '@/components/drilldown/DrillDownPanel';
import { DrillDownEntity, parseDrillDownParams } from '@/lib/drilldown';

export default function DrillDownPage() {
  const { type } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  
  const entity = (type as DrillDownEntity) || 'stores';
  const filters = parseDrillDownParams(searchParams);
  const title = searchParams.get('title') || undefined;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <DrillDownPanel 
          entity={entity} 
          filters={filters} 
          title={title}
        />
      </div>
    </div>
  );
}
