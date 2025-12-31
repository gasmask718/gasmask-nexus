import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, Camera, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhotoUploadMultipleProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  folder?: string;
}

export function PhotoUploadMultiple({ 
  photos = [], 
  onChange, 
  maxPhotos = 10,
  folder = 'visit-photos' 
}: PhotoUploadMultipleProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed max
    if (photos.length + files.length > maxPhotos) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Validate all files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return;
      }
    }

    // Upload files one by one
    const newPhotoUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadingIndex(i);
      
      try {
        // Generate unique filename
        const ext = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}-${i}.${ext}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(data.path);

        newPhotoUrls.push(urlData.publicUrl);
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}: ${error.message || 'Unknown error'}`);
      }
    }

    setUploadingIndex(null);
    
    if (newPhotoUrls.length > 0) {
      onChange([...photos, ...newPhotoUrls]);
      toast.success(`Uploaded ${newPhotoUrls.length} photo${newPhotoUrls.length > 1 ? 's' : ''}`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photoUrl = photos[index];
    
    // Try to delete from storage
    if (photoUrl) {
      try {
        const url = new URL(photoUrl);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf('product-images');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('product-images').remove([filePath]);
        }
      } catch (error) {
        console.error('Error removing photo from storage:', error);
        // Continue with removal from array even if storage deletion fails
      }
    }

    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Photos {photos.length > 0 && `(${photos.length}/${maxPhotos})`}
        </Label>
        {photos.length < maxPhotos && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingIndex !== null}
          >
            {uploadingIndex !== null ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Add Photo
              </>
            )}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg border bg-muted overflow-hidden">
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemovePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div 
          className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Tap to add photos
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max {maxPhotos} photos, 5MB each
          </p>
        </div>
      )}

      {photos.length > 0 && photos.length < maxPhotos && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingIndex !== null}
          className="w-full"
        >
          {uploadingIndex !== null ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add More Photos
            </>
          )}
        </Button>
      )}
    </div>
  );
}

