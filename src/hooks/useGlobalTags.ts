import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GlobalTag {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TagAttachment {
  id: string;
  tag_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

// Generate a slug from a tag name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// Fetch all active global tags
export function useGlobalTags(category?: string) {
  return useQuery({
    queryKey: ['global-tags', category],
    queryFn: async () => {
      let query = supabase
        .from('global_tags')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GlobalTag[];
    },
  });
}

// Fetch tags attached to a specific entity
export function useEntityTags(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['entity-tags', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag_attachments')
        .select(`
          id,
          tag_id,
          entity_type,
          entity_id,
          created_at,
          global_tags (
            id,
            name,
            slug,
            category,
            status
          )
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (error) throw error;
      return data as (TagAttachment & { global_tags: GlobalTag })[];
    },
    enabled: !!entityType && !!entityId,
  });
}

// Hook for tag mutations
export function useTagMutations() {
  const queryClient = useQueryClient();

  // Create a new global tag
  const createTag = useMutation({
    mutationFn: async ({ name, category = 'general' }: { name: string; category?: string }) => {
      const slug = generateSlug(name);
      
      // Check if tag already exists
      const { data: existing } = await supabase
        .from('global_tags')
        .select('id, name')
        .ilike('name', name)
        .single();

      if (existing) {
        return existing as GlobalTag;
      }

      const { data, error } = await supabase
        .from('global_tags')
        .insert({ name: name.trim(), slug, category, status: 'active' })
        .select()
        .single();

      if (error) throw error;
      return data as GlobalTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-tags'] });
    },
    onError: (error) => {
      console.error('Failed to create tag:', error);
      toast.error('Failed to create tag');
    },
  });

  // Attach a tag to an entity
  const attachTag = useMutation({
    mutationFn: async ({ tagId, entityType, entityId }: { tagId: string; entityType: string; entityId: string }) => {
      const { data, error } = await supabase
        .from('tag_attachments')
        .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
        .select()
        .single();

      if (error) {
        // Ignore unique constraint violation (tag already attached)
        if (error.code === '23505') {
          return null;
        }
        throw error;
      }
      return data as TagAttachment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entity-tags', variables.entityType, variables.entityId] });
    },
    onError: (error) => {
      console.error('Failed to attach tag:', error);
      toast.error('Failed to attach tag');
    },
  });

  // Detach a tag from an entity
  const detachTag = useMutation({
    mutationFn: async ({ tagId, entityType, entityId }: { tagId: string; entityType: string; entityId: string }) => {
      const { error } = await supabase
        .from('tag_attachments')
        .delete()
        .eq('tag_id', tagId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entity-tags', variables.entityType, variables.entityId] });
    },
    onError: (error) => {
      console.error('Failed to detach tag:', error);
      toast.error('Failed to remove tag');
    },
  });

  // Create tag and attach it to entity in one operation
  const createAndAttachTag = useMutation({
    mutationFn: async ({ name, entityType, entityId, category = 'general' }: { 
      name: string; 
      entityType: string; 
      entityId: string;
      category?: string;
    }) => {
      // First, create or get the tag
      const tag = await createTag.mutateAsync({ name, category });
      
      // Then attach it
      if (tag?.id) {
        await attachTag.mutateAsync({ tagId: tag.id, entityType, entityId });
      }
      
      return tag;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['global-tags'] });
      queryClient.invalidateQueries({ queryKey: ['entity-tags', variables.entityType, variables.entityId] });
      toast.success('Tag added');
    },
    onError: (error) => {
      console.error('Failed to create and attach tag:', error);
      toast.error('Failed to add tag');
    },
  });

  return {
    createTag,
    attachTag,
    detachTag,
    createAndAttachTag,
  };
}
