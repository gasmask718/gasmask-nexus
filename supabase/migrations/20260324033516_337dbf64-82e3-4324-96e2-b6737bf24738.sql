ALTER TABLE sbo_results_verification
ADD COLUMN IF NOT EXISTS was_correct boolean,
ADD COLUMN IF NOT EXISTS actual_winner text,
ADD COLUMN IF NOT EXISTS actual_value numeric,
ADD COLUMN IF NOT EXISTS verdict_note text;

ALTER TABLE sbo_results_verification
DROP CONSTRAINT IF EXISTS sbo_results_verification_prediction_id_unique;

ALTER TABLE sbo_results_verification
ADD CONSTRAINT sbo_results_verification_prediction_id_unique UNIQUE (prediction_id);