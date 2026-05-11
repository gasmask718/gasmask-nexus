CREATE OR REPLACE VIEW public.v_store_tube_summary AS
 WITH eff AS (
         SELECT i.store_id,
            vet.invoice_id,
            vet.tube_count,
            vet.total,
            i.created_at AS invoice_date
           FROM v_invoice_effective_tubes vet
             JOIN invoices i ON i.id = vet.invoice_id
          WHERE i.store_id IS NOT NULL AND i.deleted_at IS NULL
        ), agg AS (
         SELECT eff.store_id,
            sum(eff.tube_count) AS lifetime,
            sum(eff.total) AS lifetime_revenue,
            count(DISTINCT eff.invoice_id)::integer AS invoice_count,
            sum(eff.tube_count) FILTER (WHERE eff.invoice_date >= (now() - '30 days'::interval)) AS d30,
            sum(eff.tube_count) FILTER (WHERE eff.invoice_date >= (now() - '90 days'::interval)) AS d90,
            sum(eff.tube_count) FILTER (WHERE eff.invoice_date >= date_trunc('month'::text, now())) AS mtd,
            sum(eff.tube_count) FILTER (WHERE eff.invoice_date >= (date_trunc('month'::text, now()) - '1 mon'::interval) AND eff.invoice_date < date_trunc('month'::text, now())) AS prior_month,
            max(eff.invoice_date) AS last_tx
           FROM eff
          GROUP BY eff.store_id
        ), on_hand AS (
         SELECT sti.store_id,
            sum(sti.current_tubes_left)::numeric AS total_on_hand
           FROM store_tube_inventory sti
          WHERE sti.brand <> 'hotscolatti'
          GROUP BY sti.store_id
        ), top_brand AS (
         SELECT DISTINCT ON (x.store_id) x.store_id,
            x.brand
           FROM ( SELECT i.store_id,
                    ili.brand,
                    sum(ili.quantity) AS s
                   FROM invoice_line_items ili
                     JOIN invoices i ON i.id = ili.invoice_id
                  WHERE ili.brand IS NOT NULL AND i.store_id IS NOT NULL AND i.deleted_at IS NULL AND i.status = 'finalized'::text
                  GROUP BY i.store_id, ili.brand) x
          ORDER BY x.store_id, x.s DESC
        )
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.neighborhood,
    s.boro,
    s.address_zip,
    s.status,
    s.assigned_ambassador_id,
    COALESCE(a.lifetime, 0::numeric) AS lifetime_tubes_sold,
    COALESCE(a.lifetime, 0::numeric) AS lifetime_tubes_delivered,
    COALESCE(a.lifetime_revenue, 0::numeric) AS lifetime_invoice_revenue,
    COALESCE(a.invoice_count, 0) AS invoice_count,
    COALESCE(oh.total_on_hand, 0::numeric) AS current_inventory_count,
    COALESCE(a.d30, 0::numeric) AS tubes_last_30_days,
    COALESCE(a.mtd, 0::numeric) AS tubes_this_month,
    COALESCE(a.d90, 0::numeric) AS tubes_last_90_days,
    tb.brand AS top_brand,
        CASE
            WHEN COALESCE(oh.total_on_hand, 0::numeric) = 0::numeric THEN 'out_of_stock'::text
            WHEN oh.total_on_hand < 50::numeric THEN 'restock_now'::text
            WHEN oh.total_on_hand < 200::numeric THEN 'restock_soon'::text
            ELSE 'stocked'::text
        END AS restock_status,
    a.last_tx AS last_tube_transaction_at,
    COALESCE(a.prior_month, 0::numeric) AS tubes_prior_month,
        CASE
            WHEN COALESCE(a.prior_month, 0::numeric) = 0::numeric THEN NULL::numeric
            ELSE round((COALESCE(a.mtd, 0::numeric) - a.prior_month) / a.prior_month * 100::numeric, 1)
        END AS tubes_mom_delta_pct
   FROM stores s
     LEFT JOIN agg a ON a.store_id = s.id
     LEFT JOIN on_hand oh ON oh.store_id = s.id
     LEFT JOIN top_brand tb ON tb.store_id = s.id
  WHERE s.deleted_at IS NULL AND (s.is_test_data = false OR s.is_test_data IS NULL);