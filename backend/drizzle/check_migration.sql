-- Check which new tables exist
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'kvb_crm'
AND TABLE_NAME IN ('project_plans','project_plan_items','project_inventory_reservations','project_collection_tasks','material_usage_history');

-- Check which financialYear columns already exist
SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'kvb_crm'
AND COLUMN_NAME = 'financialYear';

-- Check canCreateProjectPlans column on users
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'kvb_crm' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'canCreateProjectPlans';
