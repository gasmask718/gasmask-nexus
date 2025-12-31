-- Create the payment_type enum
CREATE TYPE payment_type AS ENUM ('pays_upfront', 'bill_to_bill');

-- Add the payment_type column to stores (nullable by default)
ALTER TABLE stores ADD COLUMN payment_type payment_type;

-- Add a comment for documentation
COMMENT ON COLUMN stores.payment_type IS 'How the store pays for orders: pays_upfront (before getting products) or bill_to_bill (after getting products)';