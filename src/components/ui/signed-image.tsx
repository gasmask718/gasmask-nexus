/**
 * SignedImage — renders an image held in a PRIVATE storage bucket.
 *
 * STANDING RULE (mem://architecture/media-src-proxy-rule): never hand a stored
 * string straight to `src` for private-bucket media. This resolves a short-lived
 * signed URL at render time and shows an explicit failure instead of a broken
 * image icon.
 */
import { useEffect, useState } from 'react';
import { signedStorageUrl } from '@/lib/storageLinks';
import { cn } from '@/lib/utils';

interface SignedImageProps {
  bucket: string;
  /** Object path (preferred) or a legacy stored URL. */
  path: string | null | undefined;
  alt: string;
  className?: string;
  expiresIn?: number;
  fallback?: React.ReactNode;
}

export function SignedImage({ bucket, path, alt, className, expiresIn = 900, fallback }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!path) return;
    signedStorageUrl(bucket, path, expiresIn)
      .then((u) => { if (active) setUrl(u); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [bucket, path, expiresIn]);

  if (!path || failed) {
    return <>{fallback ?? <div className={cn('bg-muted flex items-center justify-center text-xs text-muted-foreground', className)}>Unavailable</div>}</>;
  }
  if (!url) {
    return <div className={cn('bg-muted animate-pulse', className)} />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
