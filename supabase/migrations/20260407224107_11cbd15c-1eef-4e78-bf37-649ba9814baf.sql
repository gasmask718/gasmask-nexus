
-- 1. Add fulfillment_model to tt_vehicles (inventory)
ALTER TABLE tt_vehicles
  ADD COLUMN IF NOT EXISTS fulfillment_model text NOT NULL DEFAULT 'request_confirm'
  CHECK (fulfillment_model IN ('request_confirm', 'quote_broadcast'));

-- Set existing vehicles based on type
UPDATE tt_vehicles SET fulfillment_model = 'quote_broadcast'
WHERE type IN ('private_jet', 'coach_bus');

UPDATE tt_vehicles SET fulfillment_model = 'request_confirm'
WHERE type IN ('slingshot', 'jet_ski', 'black_truck', 'exotic_car', 'sprinter', 'party_bus', 'yacht', 'boat', 'yacht_boat');

-- 2. Add fulfillment columns to tt_bookings
ALTER TABLE tt_bookings
  ADD COLUMN IF NOT EXISTS fulfillment_model text DEFAULT 'request_confirm'
    CHECK (fulfillment_model IN ('request_confirm', 'quote_broadcast')),
  ADD COLUMN IF NOT EXISTS payment_hold_status text DEFAULT 'none'
    CHECK (payment_hold_status IN ('none', 'hold_placed', 'charged', 'released')),
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES tt_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tt_bookings_fulfillment ON tt_bookings(fulfillment_model);
CREATE INDEX IF NOT EXISTS idx_tt_bookings_vehicle ON tt_bookings(vehicle_id);

-- 3. Trigger: enforce fulfillment rules on booking
CREATE OR REPLACE FUNCTION enforce_fulfillment_model()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- request_confirm requires a partner
  IF NEW.fulfillment_model = 'request_confirm' AND NEW.partner_id IS NULL THEN
    RAISE EXCEPTION 'request_confirm bookings require a selected partner_id';
  END IF;
  -- quote_broadcast must NOT pre-assign partner
  IF NEW.fulfillment_model = 'quote_broadcast' AND NEW.partner_id IS NOT NULL THEN
    RAISE EXCEPTION 'quote_broadcast bookings must not pre-assign a partner — wait for quotes';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_fulfillment
  BEFORE INSERT ON tt_bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_fulfillment_model();

-- 4. Trigger: payment rules
CREATE OR REPLACE FUNCTION enforce_payment_rules()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- quote_broadcast cannot be charged upfront
  IF NEW.fulfillment_model = 'quote_broadcast'
     AND NEW.payment_hold_status IN ('hold_placed', 'charged')
     AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'quote_broadcast bookings cannot capture payment before a quote is selected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_payment_rules
  BEFORE INSERT OR UPDATE ON tt_bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_payment_rules();

-- 5. Broadcast quotes table
CREATE TABLE IF NOT EXISTS tt_broadcast_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES tt_bookings(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES tt_partners(id) ON DELETE CASCADE,
  quoted_price numeric NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'selected', 'rejected', 'expired')),
  is_selected boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tt_broadcast_quotes_booking ON tt_broadcast_quotes(booking_id);
CREATE INDEX idx_tt_broadcast_quotes_partner ON tt_broadcast_quotes(partner_id);

ALTER TABLE tt_broadcast_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage broadcast quotes"
  ON tt_broadcast_quotes TO authenticated
  USING (true) WITH CHECK (true);

-- 6. Trigger: when a broadcast quote is selected, assign partner to booking
CREATE OR REPLACE FUNCTION on_broadcast_quote_selected()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_selected = true AND (OLD.is_selected IS DISTINCT FROM true) THEN
    -- Mark other quotes as rejected
    UPDATE tt_broadcast_quotes
      SET status = 'rejected'
      WHERE booking_id = NEW.booking_id AND id != NEW.id AND status = 'submitted';

    -- Assign partner to booking (disable fulfillment trigger temporarily via status)
    UPDATE tt_bookings
      SET partner_id = NEW.partner_id,
          total_price = NEW.quoted_price,
          status = 'confirmed',
          updated_at = now()
      WHERE id = NEW.booking_id;

    NEW.status := 'selected';
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_quote_selected
  BEFORE UPDATE ON tt_broadcast_quotes
  FOR EACH ROW
  EXECUTE FUNCTION on_broadcast_quote_selected();

-- 7. Allow the quote-selection update to bypass the fulfillment trigger
-- Replace the insert-only trigger with one that skips validation on confirmed bookings
DROP TRIGGER IF EXISTS trg_enforce_fulfillment ON tt_bookings;

CREATE OR REPLACE FUNCTION enforce_fulfillment_model()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Skip enforcement on updates that are confirming a quote selection
  IF TG_OP = 'UPDATE' AND NEW.status = 'confirmed' AND NEW.fulfillment_model = 'quote_broadcast' THEN
    RETURN NEW;
  END IF;
  IF NEW.fulfillment_model = 'request_confirm' AND NEW.partner_id IS NULL THEN
    RAISE EXCEPTION 'request_confirm bookings require a selected partner_id';
  END IF;
  IF NEW.fulfillment_model = 'quote_broadcast' AND NEW.partner_id IS NOT NULL THEN
    RAISE EXCEPTION 'quote_broadcast bookings must not pre-assign a partner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_fulfillment
  BEFORE INSERT OR UPDATE ON tt_bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_fulfillment_model();

-- Add realtime for broadcast quotes
ALTER PUBLICATION supabase_realtime ADD TABLE tt_broadcast_quotes;
