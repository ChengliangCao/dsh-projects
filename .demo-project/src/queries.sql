-- 2026-09 采样：payments 慢查询
SELECT * FROM charges WHERE customer_id = $1 ORDER BY created_at DESC;
