-- Disable just the enforcement trigger to backfill geocoded coordinates
ALTER TABLE delivery_tasks DISABLE TRIGGER trg_enforce_delivery_tasks_update;

UPDATE delivery_tasks SET delivery_lat = 41.12522, delivery_lng = -80.64159 WHERE id = '0420239f-413c-4941-9733-e03cdf02afb5' AND delivery_lat IS NULL;
UPDATE delivery_tasks SET delivery_lat = 25.774634, delivery_lng = -80.131931 WHERE id = '1a2743c2-dd5e-424d-b010-1cdada40b602' AND delivery_lat IS NULL;
UPDATE delivery_tasks SET delivery_lat = 41.187405, delivery_lng = -80.571991 WHERE id = '2a3231fb-fd16-4274-a7a1-040ddb773d3d' AND delivery_lat IS NULL;
UPDATE delivery_tasks SET delivery_lat = 41.158524, delivery_lng = -80.720391 WHERE id = '4ada5089-c095-4d0f-9a44-37fd5c371070' AND delivery_lat IS NULL;

-- Re-enable the trigger
ALTER TABLE delivery_tasks ENABLE TRIGGER trg_enforce_delivery_tasks_update;