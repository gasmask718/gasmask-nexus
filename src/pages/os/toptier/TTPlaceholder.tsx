import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function TTPlaceholder() {
  const { pathname } = useLocation();
  const page = pathname.split('/').pop() || 'page';
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="bg-[#111111] border-[#C9A84C]/10 max-w-md">
        <CardContent className="p-8 text-center">
          <Construction className="h-12 w-12 text-[#C9A84C]/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white/70 capitalize">{page.replace(/-/g, ' ')}</h2>
          <p className="text-sm text-white/30 mt-2">This page is coming in the next phase.</p>
        </CardContent>
      </Card>
    </div>
  );
}
