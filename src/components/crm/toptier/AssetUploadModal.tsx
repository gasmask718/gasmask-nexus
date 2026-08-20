/**
 * Asset Upload Modal - Upload documents and assets to partner profile
 */
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, FileText, File, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSimulationMode } from '@/contexts/SimulationModeContext';

interface AssetUploadModalProps {
  partnerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ASSET_TYPES = [
  { id: 'contract', label: 'Contract' },
  { id: 'document', label: 'Document' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'media', label: 'Media' },
  { id: 'other', label: 'Other' },
];

export default function AssetUploadModal({ partnerId, open, onOpenChange, onSuccess }: AssetUploadModalProps) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetType, setAssetType] = useState('document');
  const [tags, setTags] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      
      if (simulationMode) {
        // Simulate upload
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, name: selectedFile.name };
      }
      
      const filePath = `partners/${partnerId}/assets/${Date.now()}-${selectedFile.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('partner-assets')
        .upload(filePath, selectedFile);
      
      if (uploadError) throw uploadError;
      
      // partner-assets is private: the object path is the durable reference.
      const publicUrl = filePath;
      
      return { path: filePath, url: publicUrl, name: selectedFile.name };
    },
    onSuccess: () => {
      toast.success('Asset uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['partner-assets', partnerId] });
      setSelectedFile(null);
      setTags('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Asset Type</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div 
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click or drag file to upload
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOC, XLS, ZIP, images, videos
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {selectedFile.type.includes('pdf') ? (
                  <FileText className="h-5 w-5 text-red-500" />
                ) : (
                  <File className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium truncate max-w-[250px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tags (comma separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., legal, active, 2024"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending || !selectedFile}>
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload Asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
