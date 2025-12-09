import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}

export function ImageUpload({ value, onChange, folder = 'products' }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

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

      onChange(urlData.publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (value) {
      try {
        // Extract path from URL
        const url = new URL(value);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.indexOf('product-images');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('product-images').remove([filePath]);
        }
      } catch (error) {
        console.error('Error removing image:', error);
      }
    }
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>Product Image</Label>
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
          {value ? (
            <img 
              src={value} 
              alt="Product" 
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </>
              )}
            </Button>
            
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            PNG, JPG or GIF. Max 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ImageUpload;