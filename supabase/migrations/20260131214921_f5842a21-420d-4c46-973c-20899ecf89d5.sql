-- Add connected_group_id to store_master for linking related store locations
ALTER TABLE public.store_master 
ADD COLUMN connected_group_id uuid;

-- Add index for efficient lookups
CREATE INDEX idx_store_master_connected_group ON public.store_master(connected_group_id) WHERE connected_group_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.store_master.connected_group_id IS 'UUID linking stores that belong to the same owner/group. When stores share this ID, they appear as connected locations.';