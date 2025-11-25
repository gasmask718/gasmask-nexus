import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

interface BlastEmailModuleProps {
  brand: string;
  brandColor?: string;
}

export default function BlastEmailModule({ brand, brandColor = '#6366f1' }: BlastEmailModuleProps) {
  return (
    <Card style={{ borderTop: `4px solid ${brandColor}` }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" style={{ color: brandColor }} />
          Blast Email - {brand}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-8">
          Email campaign builder for {brand} - Template editor, variables, analytics
        </p>
      </CardContent>
    </Card>
  );
}
