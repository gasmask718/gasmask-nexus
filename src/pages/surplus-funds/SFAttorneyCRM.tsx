import { SFRecruitingQueue } from './components/SFRecruitingQueue';
import { Scale } from 'lucide-react';

export default function SFAttorneyCRM() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
          <Scale className="h-6 w-6" /> Attorney CRM
        </h1>
        <p className="text-sm text-muted-foreground">
          Recruiting pipeline, jurisdiction coverage, and email-first outreach for attorney partners
        </p>
      </div>
      <SFRecruitingQueue />
    </div>
  );
}
