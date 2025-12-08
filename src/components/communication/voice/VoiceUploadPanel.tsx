import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileAudio, X, Sparkles, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
}

export default function VoiceUploadPanel() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [voiceName, setVoiceName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (newFiles: File[]) => {
    const audioFiles = newFiles.filter(f => 
      f.type.startsWith('audio/') || f.name.endsWith('.wav') || f.name.endsWith('.mp3')
    );

    if (audioFiles.length === 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload WAV or MP3 audio files",
        variant: "destructive"
      });
      return;
    }

    const uploadedFiles: UploadedFile[] = audioFiles.map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'uploading'
    }));

    setFiles(prev => [...prev, ...uploadedFiles]);

    // Simulate upload progress
    uploadedFiles.forEach(file => {
      simulateUpload(file.id);
    });
  };

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress, status: progress >= 100 ? 'processing' : 'uploading' } : f
      ));
      
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'complete' } : f
          ));
        }, 2000);
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Voice Samples</CardTitle>
          <CardDescription>
            Upload audio files to create a custom voice profile. We recommend 3-5 minutes of clear speech.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="voice-name">Voice Name</Label>
            <Input 
              id="voice-name"
              placeholder="e.g., Sales Rep Mike"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
            />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Drop audio files here</p>
            <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
            <Input
              type="file"
              accept="audio/*,.wav,.mp3"
              multiple
              className="hidden"
              id="file-upload"
              onChange={handleFileSelect}
            />
            <Button variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select Files
              </label>
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileAudio className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  {file.status === 'processing' && (
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  )}
                  {file.status === 'complete' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full" disabled={files.length === 0 || !voiceName}>
            <Sparkles className="h-4 w-4 mr-2" />
            Train Voice Model
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice Training Tips</CardTitle>
          <CardDescription>
            Follow these guidelines for best results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <p className="font-medium">Use high-quality recordings</p>
                <p className="text-sm text-muted-foreground">44.1kHz sample rate, minimal background noise</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <p className="font-medium">Record 3-5 minutes of speech</p>
                <p className="text-sm text-muted-foreground">More samples improve voice quality and consistency</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <p className="font-medium">Speak naturally</p>
                <p className="text-sm text-muted-foreground">Use your normal tone and pace for best cloning results</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <p className="font-medium">Include emotional variety</p>
                <p className="text-sm text-muted-foreground">Record samples with different emotional tones</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
