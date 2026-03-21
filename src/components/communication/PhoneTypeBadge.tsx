import { Badge } from '@/components/ui/badge';

interface PhoneTypeBadgeProps {
  type?: string | null;
  smsCapable?: boolean | null;
}

export function PhoneTypeBadge({ type, smsCapable }: PhoneTypeBadgeProps) {
  if (!type || type === 'unknown') return null;

  const icon = type === 'mobile' ? '📱' : type === 'landline' ? '☎️' : '💻';
  const isLandline = type === 'landline';

  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-0.5 ${
        isLandline
          ? 'border-destructive/30 text-destructive'
          : 'border-green-500/30 text-green-600'
      }`}
    >
      {icon} {type}
      {isLandline && ' · No SMS'}
    </Badge>
  );
}
