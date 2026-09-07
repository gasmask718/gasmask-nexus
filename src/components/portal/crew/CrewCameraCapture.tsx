import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, X } from 'lucide-react';

/**
 * Camera-only capture for crew drops.
 * Uses getUserMedia + canvas — there is deliberately NO file input / gallery
 * fallback, so a photo can only come from the live rear camera.
 */
interface CrewCameraCaptureProps {
  onCaptured: (blob: Blob, previewUrl: string) => void;
  onCleared: () => void;
  previewUrl: string | null;
}

export function CrewCameraCapture({ onCaptured, onCleared, previewUrl }: CrewCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This device has no camera access in the browser. A photo can only be taken with the camera.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera permission denied');
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      stop();
      onCaptured(blob, URL.createObjectURL(blob));
    }, 'image/jpeg', 0.85);
  };

  if (previewUrl) {
    return (
      <div className="space-y-2">
        <img src={previewUrl} alt="Drop photo just taken" className="w-full rounded-md border border-border" />
        <Button type="button" variant="outline" className="w-full" onClick={() => { onCleared(); void start(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retake photo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {active ? (
        <>
          <video ref={videoRef} playsInline muted className="w-full rounded-md border border-border bg-black" />
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={shoot}>
              <Camera className="h-4 w-4 mr-2" /> Take photo
            </Button>
            <Button type="button" variant="outline" onClick={stop}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={start}>
          <Camera className="h-4 w-4 mr-2" /> Open camera
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default CrewCameraCapture;
