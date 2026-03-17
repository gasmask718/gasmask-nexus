ALTER TABLE delivery_tasks DISABLE TRIGGER trg_enforce_delivery_tasks_update;
UPDATE delivery_tasks
SET delivery_lat = 41.12522,
    delivery_lng = -80.64159
WHERE id = '0420239f-413c-4941-9733-e03cdf02afb5';
ALTER TABLE delivery_tasks ENABLE TRIGGER trg_enforce_delivery_tasks_update;