/**
 * storageLinks — signed-read helpers for private storage buckets.
 *
 * STANDING RULE (mem://architecture/media-src-proxy-rule):
 * Private-bucket media/documents are never rendered from a stored URL string.
 * `getPublicUrl` never fails — it string-concatenates, so it happily returns a
 * dead link for a private (or nonexistent) bucket. Store the OBJECT PATH and
 * mint a short-lived signed URL at click time instead.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Accepts either a bare object path (the correct, current shape) or a legacy
 * public/signed URL written before the bucket was closed, and returns the path.
 */
export function storageObjectPath(bucket: string, value: string): string {
  if (!value) return value;
  if (!value.startsWith('http')) return value.replace(/^\/+/, '');

  const marker = `/${bucket}/`;
  const idx = value.indexOf(marker);
  const tail = idx >= 0 ? value.slice(idx + marker.length) : value;
  // strip any query string from a signed URL
  return decodeURIComponent(tail.split('?')[0]);
}

/**
 * Mint a short-lived signed URL for a private object.
 * Throws the raw Supabase error so callers surface it rather than a dead link.
 */
export async function signedStorageUrl(
  bucket: string,
  value: string,
  expiresIn = 300,
): Promise<string> {
  const path = storageObjectPath(bucket, value);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned');
  return data.signedUrl;
}

/** Open a private object in a new tab via a short-lived signed URL. */
export async function openSignedStorageObject(
  bucket: string,
  value: string,
  expiresIn = 300,
): Promise<void> {
  const url = await signedStorageUrl(bucket, value, expiresIn);
  window.open(url, '_blank', 'noopener,noreferrer');
}
