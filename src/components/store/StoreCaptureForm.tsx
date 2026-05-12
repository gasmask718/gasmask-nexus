import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Camera, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface StoreCaptureFormProps {
  onCaptured?: (storeId: string, autoApproved: boolean) => void;
  onCancel?: () => void;
  defaultName?: string;
  defaultAddress?: string;
}

type AppRoleString =
  | 'owner'
  | 'admin'
  | 'driver'
  | 'biker'
  | 'ambassador';

const AUTO_APPROVE_ROLES: AppRoleString[] = ['owner', 'admin'];
const ALLOWED_CAPTURE_ROLES: AppRoleString[] = [
  'owner',
  'admin',
  'driver',
  'biker',
  'ambassador',
];

function pickCaptureRole(roles: string[] | null | undefined): AppRoleString | null {
  if (!roles || roles.length === 0) return null;
  // Priority order: owner > admin > ambassador > driver > biker
  const priority: AppRoleString[] = [
    'owner',
    'admin',
    'ambassador',
    'driver',
    'biker',
  ];
  for (const r of priority) {
    if (roles.includes(r)) return r;
  }
  return null;
}

export function StoreCaptureForm({
  onCaptured,
  onCancel,
  defaultName = '',
  defaultAddress = '',
}: StoreCaptureFormProps) {
  const { roles, loading: roleLoading } = useUserRole();
  const captureRole = pickCaptureRole(roles);
  const isAuthorized =
    !!captureRole && ALLOWED_CAPTURE_ROLES.includes(captureRole);
  const willAutoApprove =
    !!captureRole && AUTO_APPROVE_ROLES.includes(captureRole);

  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-capture GPS on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation not supported on this device');
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(err.message || 'Unable to read GPS');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized || !captureRole) {
      toast.error('You do not have permission to capture stores');
      return;
    }
    if (!name.trim() || !address.trim()) {
      toast.error('Name and address are required');
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // 1. Upload photo if provided
      let storefrontPhotoUrl: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${captureRole}/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('storefront-captures')
          .upload(path, photoFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: photoFile.type,
          });
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
        const { data: urlData } = supabase.storage
          .from('storefront-captures')
          .getPublicUrl(path);
        storefrontPhotoUrl = urlData.publicUrl;
      }

      // 2. Build store row
      const approvalStatus = willAutoApprove ? 'approved' : 'pending';
      const storeStatus = willAutoApprove ? 'prospect' : 'pending';
      const composedNotes = ownerName.trim()
        ? `Owner: ${ownerName.trim()}${notes.trim() ? `\n${notes.trim()}` : ''}`
        : notes.trim() || null;

      const insertPayload: Record<string, unknown> = {
        name: name.trim(),
        address_street: address.trim(),
        phone: phone.trim() || null,
        notes: composedNotes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        storefront_photo_url: storefrontPhotoUrl,
        status: storeStatus,
        approval_status: approvalStatus,
        captured_by_user_id: user.id,
        captured_at: new Date().toISOString(),
        captured_role: captureRole,
        approved_by_user_id: willAutoApprove ? user.id : null,
        approved_at: willAutoApprove ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from('stores')
        .insert(insertPayload as any)
        .select('id')
        .single();

      if (error) throw error;

      toast.success(
        willAutoApprove
          ? 'Store captured & auto-approved'
          : 'Store captured — pending review',
      );
      onCaptured?.(data.id, willAutoApprove);
    } catch (err: any) {
      console.error('[StoreCaptureForm] submit error:', err);
      toast.error(err.message || 'Failed to capture store');
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isAuthorized) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          You don't have permission to capture stores. Required role:
          owner, admin, ambassador, driver, or biker.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Capture New Store</CardTitle>
          <Badge variant={willAutoApprove ? 'default' : 'secondary'}>
            {willAutoApprove ? 'Auto-approve' : 'Pending review'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {gpsLoading
            ? 'Acquiring GPS…'
            : coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : gpsError || 'GPS unavailable'}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cap-name">
              Store name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cap-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lenox Deli Corp"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cap-address">
              Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cap-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="565 Lenox Ave, New York, NY"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cap-phone">Phone</Label>
              <Input
                id="cap-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-1212"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-owner">Owner name</Label>
              <Input
                id="cap-owner"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="On-site contact"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cap-notes">Notes</Label>
            <Textarea
              id="cap-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Storefront photo
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative inline-block">
                <img
                  src={photoPreview}
                  alt="Storefront preview"
                  className="h-40 w-40 object-cover rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={clearPhoto}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take / upload photo
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Capture store
                </>
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            Captured as <strong>{captureRole}</strong>.{' '}
            {willAutoApprove
              ? 'Will be added directly as a prospect.'
              : 'Will appear in the admin review queue.'}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default StoreCaptureForm;
