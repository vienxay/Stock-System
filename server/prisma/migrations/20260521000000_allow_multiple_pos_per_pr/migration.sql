-- Drop 1:1 constraint: one PR may have multiple POs (one per supplier)
DROP INDEX IF EXISTS "purchase_orders_pr_id_key";

CREATE INDEX IF NOT EXISTS "purchase_orders_pr_id_idx" ON "purchase_orders"("pr_id");
