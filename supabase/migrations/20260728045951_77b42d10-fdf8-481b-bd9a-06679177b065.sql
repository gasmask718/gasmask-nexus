ALTER TABLE public.communication_logs
  ADD CONSTRAINT communication_logs_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;