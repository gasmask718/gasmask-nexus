import { format } from 'date-fns';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StoreClaimStatusProps {
  storeName: string;
  securedByMe: boolean;
  securedAmbassadorName: string | null;
  securedAt: string | null;
  onSecure?: () => Promise<unknown>;
  isSecuring?: boolean;
  compact?: boolean;
}

export function StoreClaimStatus({
  storeName,
  securedByMe,
  securedAmbassadorName,
  securedAt,
  onSecure,
  isSecuring = false,
  compact = false,
}: StoreClaimStatusProps) {
  if (securedAmbassadorName) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={securedByMe ? 'default' : 'secondary'} className="gap-1">
          <LockKeyhole className="h-3 w-3" />
          {securedByMe ? 'Secured by you' : `Secured by ${securedAmbassadorName}`}
        </Badge>
        {!compact && securedAt && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(securedAt), 'MMM d, yyyy h:mm a')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> Available
      </Badge>
      {onSecure && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={isSecuring} onClick={(event) => event.stopPropagation()}>
              <LockKeyhole className="mr-1 h-3.5 w-3.5" />
              {isSecuring ? 'Securing…' : 'Secure Store'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(event) => event.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Secure {storeName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This creates the single secured-store lock. Other ambassadors in this area will still see the store and who secured it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onSecure()}>Confirm secure</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}