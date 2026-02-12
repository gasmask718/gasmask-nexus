
-- 1. Update existing rows to valid values before enum swap
UPDATE store_brand_relationships
SET payment_type = 'bill_to_bill'
WHERE payment_type::text NOT IN ('pay_upfront', 'bill_to_bill');

-- 2. Create new restricted enum
CREATE TYPE payment_type_enum_v2 AS ENUM ('pay_upfront', 'bill_to_bill');

-- 3. Add temporary column
ALTER TABLE store_brand_relationships
ADD COLUMN payment_type_new payment_type_enum_v2;

-- 4. Migrate values
UPDATE store_brand_relationships
SET payment_type_new = payment_type::text::payment_type_enum_v2;

-- 5. Drop old column
ALTER TABLE store_brand_relationships DROP COLUMN payment_type;

-- 6. Rename new column
ALTER TABLE store_brand_relationships RENAME COLUMN payment_type_new TO payment_type;

-- 7. Set default
ALTER TABLE store_brand_relationships ALTER COLUMN payment_type SET DEFAULT 'bill_to_bill'::payment_type_enum_v2;

-- 8. Drop old enum
DROP TYPE payment_type_enum;

-- 9. Rename new enum
ALTER TYPE payment_type_enum_v2 RENAME TO payment_type_enum;
