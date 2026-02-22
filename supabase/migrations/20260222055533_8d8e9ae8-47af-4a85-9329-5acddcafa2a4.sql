
-- ============================================================
-- PHASE 5: Platform-Mediated Order Messaging System
-- ============================================================

-- 1. Create enum for sender roles
DO $$ BEGIN
  CREATE TYPE public.message_sender_role AS ENUM ('customer', 'vendor', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create enum for message types
DO $$ BEGIN
  CREATE TYPE public.order_message_type AS ENUM ('standard', 'system', 'dispute_related');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create order_messages table
CREATE TABLE public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  sender_role message_sender_role NOT NULL,
  vendor_id uuid REFERENCES public.wholesaler_profiles(id),
  message_body text NOT NULL CHECK (length(message_body) <= 2000),
  message_type order_message_type NOT NULL DEFAULT 'standard',
  is_read boolean NOT NULL DEFAULT false,
  attachment_url text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Indexes for performance
CREATE INDEX idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX idx_order_messages_vendor_id ON public.order_messages(vendor_id);
CREATE INDEX idx_order_messages_sender ON public.order_messages(sender_user_id);
CREATE INDEX idx_order_messages_created ON public.order_messages(order_id, created_at);

-- 5. Enable RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- 6. Helper: check if user is the order customer
CREATE OR REPLACE FUNCTION public.is_order_customer(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_orders
    WHERE id = _order_id AND user_id = _user_id
  );
$$;

-- 7. Helper: check if user is vendor for this order (via fulfillments)
CREATE OR REPLACE FUNCTION public.is_order_vendor(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_fulfillments mf
    JOIN wholesaler_profiles wp ON wp.id = mf.wholesaler_id
    WHERE mf.order_id = _order_id AND wp.user_id = _user_id
  );
$$;

-- 8. Helper: get vendor_id for a user
CREATE OR REPLACE FUNCTION public.get_user_vendor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM wholesaler_profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 9. RLS: Customers see messages on their orders (only their vendor thread or system/admin messages)
CREATE POLICY "Customers view own order messages"
  ON public.order_messages FOR SELECT
  USING (
    is_order_customer(auth.uid(), order_id)
    AND is_archived = false
  );

-- 10. RLS: Vendors see only messages in their vendor thread
CREATE POLICY "Vendors view own thread messages"
  ON public.order_messages FOR SELECT
  USING (
    (vendor_id = get_user_vendor_id(auth.uid()) OR vendor_id IS NULL)
    AND is_order_vendor(auth.uid(), order_id)
    AND is_archived = false
  );

-- 11. RLS: Admins see all
CREATE POLICY "Admins view all messages"
  ON public.order_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

-- 12. RLS: Customers can insert messages on their own orders
CREATE POLICY "Customers send messages on own orders"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND sender_role = 'customer'
    AND is_order_customer(auth.uid(), order_id)
  );

-- 13. RLS: Vendors can insert messages on orders they fulfill
CREATE POLICY "Vendors send messages on own fulfillments"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    AND sender_role = 'vendor'
    AND vendor_id = get_user_vendor_id(auth.uid())
    AND is_order_vendor(auth.uid(), order_id)
  );

-- 14. RLS: Admins can insert system messages
CREATE POLICY "Admins send system messages"
  ON public.order_messages FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

-- 15. RLS: Only admin can update (for archiving)
CREATE POLICY "Admins can archive messages"
  ON public.order_messages FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
  );

-- 16. Mark messages as read by recipient
CREATE POLICY "Recipients can mark messages read"
  ON public.order_messages FOR UPDATE
  USING (
    (is_order_customer(auth.uid(), order_id) OR is_order_vendor(auth.uid(), order_id))
    AND sender_user_id != auth.uid()
  )
  WITH CHECK (
    is_read = true
    AND is_archived = false
  );

-- 17. No deletes allowed
-- (No DELETE policy = no one can delete)

-- 18. Enable realtime for live messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- 19. Auto-tag dispute messages trigger
CREATE OR REPLACE FUNCTION public.auto_tag_dispute_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM marketplace_orders
    WHERE id = NEW.order_id
    AND dispute_status NOT IN ('none', '')
    AND dispute_status IS NOT NULL
  ) THEN
    NEW.message_type := 'dispute_related';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_tag_dispute_messages
  BEFORE INSERT ON public.order_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_tag_dispute_messages();
