import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VisitPhotoCaptureProps {
  photos: File[];
  onChange: (photos: File[]) => void;
  maxPhotos?: number;
}

/**
 * Phone-first photo capture for field visit proof.
 * Files stay local until the visit is submitted; upload happens in StoreVisitEngine
 * to the private field-visit-photos bucket (path stored in store_visits.photo_paths).
 */
export function VisitPhotoCapture({ photos, onChange, maxPhotos = 4 }: VisitPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    const nextPreviews = [...previews];
    for (const file of Array.from(files)) {
      if (next.length >= maxPhotos) break;
      if (!file.type.startsWith('image/')) continue;
      next.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    }
    setPreviews(nextPreviews);
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setPreviews(previews.filter((_, i) => i !== index));
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Visit photo upload"
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={photos.length >= maxPhotos}
      >
        <Camera className="h-4 w-4" />
        {photos.length === 0 ? 'Add visit photo' : `Add another photo (${photos.length}/${maxPhotos})`}
      </Button>
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              <img src={src} alt={`Visit photo ${i + 1}`} className="h-20 w-20 rounded-md object-cover border border-border" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
