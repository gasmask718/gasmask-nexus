import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useGlobalTags, useEntityTags, useTagMutations, GlobalTag } from '@/hooks/useGlobalTags';

interface GlobalTagSelectorProps {
  entityType: string;
  entityId: string;
  className?: string;
  placeholder?: string;
  showSelectedTags?: boolean;
  category?: string;
}

export function GlobalTagSelector({
  entityType,
  entityId,
  className,
  placeholder = 'Select tags...',
  showSelectedTags = true,
  category,
}: GlobalTagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const { data: allTags = [], isLoading: tagsLoading } = useGlobalTags(category);
  const { data: entityTags = [], isLoading: entityTagsLoading } = useEntityTags(entityType, entityId);
  const { createAndAttachTag, attachTag, detachTag } = useTagMutations();

  const selectedTagIds = useMemo(() => 
    entityTags.map(et => et.tag_id),
    [entityTags]
  );

  const selectedTags = useMemo(() =>
    entityTags.map(et => et.global_tags).filter(Boolean),
    [entityTags]
  );

  const handleSelectTag = async (tag: GlobalTag) => {
    const isSelected = selectedTagIds.includes(tag.id);
    
    if (isSelected) {
      await detachTag.mutateAsync({ tagId: tag.id, entityType, entityId });
    } else {
      await attachTag.mutateAsync({ tagId: tag.id, entityType, entityId });
    }
  };

  const handleCreateTag = async () => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) return;

    await createAndAttachTag.mutateAsync({
      name: trimmedValue,
      entityType,
      entityId,
      category: category || 'general',
    });
    
    setSearchValue('');
  };

  const handleRemoveTag = async (tagId: string) => {
    await detachTag.mutateAsync({ tagId, entityType, entityId });
  };

  const filteredTags = useMemo(() => {
    if (!searchValue) return allTags;
    return allTags.filter(tag =>
      tag.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allTags, searchValue]);

  const canCreateTag = searchValue.trim() && 
    !allTags.some(tag => tag.name.toLowerCase() === searchValue.trim().toLowerCase());

  const isLoading = tagsLoading || entityTagsLoading;
  const isMutating = createAndAttachTag.isPending || attachTag.isPending || detachTag.isPending;

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={isLoading || isMutating}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4" />
              {placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-popover border border-border z-50" align="start">
          <Command>
            <CommandInput 
              placeholder="Search or create tag..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                {canCreateTag ? (
                  <button
                    onClick={handleCreateTag}
                    className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded-md transition-colors"
                    disabled={isMutating}
                  >
                    <Plus className="h-4 w-4" />
                    Create "{searchValue.trim()}"
                  </button>
                ) : (
                  'No tags found.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {canCreateTag && filteredTags.length > 0 && (
                  <CommandItem
                    onSelect={handleCreateTag}
                    className="flex items-center gap-2 cursor-pointer"
                    disabled={isMutating}
                  >
                    <Plus className="h-4 w-4" />
                    Create "{searchValue.trim()}"
                  </CommandItem>
                )}
                {filteredTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleSelectTag(tag)}
                      className="cursor-pointer"
                      disabled={isMutating}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {tag.name}
                      {tag.category && tag.category !== 'general' && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {tag.category}
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showSelectedTags && selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                disabled={isMutating}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
