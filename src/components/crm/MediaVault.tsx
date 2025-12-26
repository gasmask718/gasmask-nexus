/**
 * MediaVault Component
 * Photo/video upload, tagging, preview grid for models (PlayBoxxx)
 */
import { useState, useRef } from 'react';
import { 
  Image, Video, Upload, Search, Tag, X, Eye, 
  Download, Trash2, Grid, List, Filter, Plus,
  FileText, Shield, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { cn } from '@/lib/utils';

export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnail_url?: string;
  tags: string[];
  consent_note?: string;
  uploaded_at: Date;
  file_name?: string;
  file_size?: number;
}

interface MediaVaultProps {
  entityId: string;
  entityType: string;
  items: MediaItem[];
  isSimulated?: boolean;
  onUpload?: (files: File[]) => Promise<void>;
  onDelete?: (mediaId: string) => Promise<void>;
  onUpdateTags?: (mediaId: string, tags: string[]) => Promise<void>;
  onUpdateConsent?: (mediaId: string, consentNote: string) => Promise<void>;
  readOnly?: boolean;
  className?: string;
}

export function MediaVault({
  entityId,
  entityType,
  items,
  isSimulated = false,
  onUpload,
  onDelete,
  onUpdateTags,
  onUpdateConsent,
  readOnly = false,
  className,
}: MediaVaultProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [newTags, setNewTags] = useState('');
  const [newConsent, setNewConsent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.file_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadFiles(files);
  };

  const handleUpload = async () => {
    if (onUpload && uploadFiles.length > 0) {
      await onUpload(uploadFiles);
      setUploadFiles([]);
      setShowUpload(false);
    }
  };

  const handleAddTag = (itemId: string, tag: string) => {
    if (onUpdateTags && tag.trim()) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        onUpdateTags(itemId, [...item.tags, tag.trim()]);
      }
    }
  };

  const handleRemoveTag = (itemId: string, tagToRemove: string) => {
    if (onUpdateTags) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        onUpdateTags(itemId, item.tags.filter(t => t !== tagToRemove));
      }
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Media Vault
            {isSimulated && <SimulationBadge />}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            {!readOnly && (
              <Dialog open={showUpload} onOpenChange={setShowUpload}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Media</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to select files or drag & drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports: JPG, PNG, MP4, MOV
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                    
                    {uploadFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Files ({uploadFiles.length})</Label>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {uploadFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                              <span className="truncate">{file.name}</span>
                              <span className="text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Tags (comma separated)</Label>
                      <Input
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        placeholder="portfolio, professional, exclusive"
                      />
                    </div>

                    <div>
                      <Label className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Consent Note
                      </Label>
                      <Textarea
                        value={newConsent}
                        onChange={(e) => setNewConsent(e.target.value)}
                        placeholder="Document consent/permissions for this media..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowUpload(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={uploadFiles.length === 0}>
                      Upload {uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="photo">Photos</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Image className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No media files found</p>
            {!readOnly && (
              <Button variant="outline" className="mt-4" onClick={() => setShowUpload(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload First File
              </Button>
            )}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && filteredItems.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="relative group aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                {item.type === 'photo' ? (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Video className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="ghost" className="text-white">
                    <Eye className="h-5 w-5" />
                  </Button>
                </div>

                {/* Type badge */}
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 text-[10px]"
                >
                  {item.type === 'photo' ? <Image className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                </Badge>

                {/* Consent indicator */}
                {item.consent_note && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                    {item.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] bg-black/50 text-white border-none">
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 2 && (
                      <Badge variant="outline" className="text-[10px] bg-black/50 text-white border-none">
                        +{item.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && filteredItems.length > 0 && (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  {item.type === 'photo' ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.type}
                    </Badge>
                    {item.consent_note && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Consent
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded {item.uploaded_at.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readOnly && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(item.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Media Preview</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  {selectedItem.type === 'photo' ? (
                    <img
                      src={selectedItem.url}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={selectedItem.url}
                      controls
                      className="w-full h-full"
                    />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedItem.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          {!readOnly && (
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => handleRemoveTag(selectedItem.id, tag)}
                            />
                          )}
                        </Badge>
                      ))}
                      {!readOnly && (
                        <Button size="sm" variant="ghost" className="h-6 px-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Consent Note
                    </Label>
                    <p className="text-sm mt-1">
                      {selectedItem.consent_note || 'No consent note recorded'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {!readOnly && (
                    <Button 
                      variant="destructive"
                      onClick={() => {
                        onDelete?.(selectedItem.id);
                        setSelectedItem(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default MediaVault;
