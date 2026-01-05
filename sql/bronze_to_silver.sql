CREATE OR REPLACE TABLE `testrail_kpis.fact_cycle`
PARTITION BY date(created_on)
AS
WITH runs AS (
  SELECT 
    id as cycle_id,
    project_id,
    plan_id,
    name as cycle_name,
    created_on,
    completed_on,
    is_completed,
    is_completed as is_closed, -- Assuming completed means closed
    passed_count,
    failed_count,
    blocked_count,
    retest_count,
    untested_count,
    -- Extract month key
    FORMAT_TIMESTAMP('%Y-%m', created_on) as month_key,
    -- Parse JSON custom status if needed, for now using standard counts
    (passed_count + failed_count + blocked_count + retest_count + untested_count) as total_tests
  FROM `testrail_kpis.raw_runs`
),
plans AS (
  SELECT id, name as plan_name FROM `testrail_kpis.raw_plans`
)
SELECT
  r.cycle_id,
  r.project_id,
  r.plan_id,
  p.plan_name,
  r.cycle_name,
  r.created_on,
  r.completed_on,
  r.is_completed as is_closed,
  -- Standard Metrics (Project 17 Only)
  CASE WHEN r.project_id = 17 THEN r.passed_count ELSE 0 END as passed_count,
  CASE WHEN r.project_id = 17 THEN r.failed_count ELSE 0 END as failed_count,
  CASE WHEN r.project_id = 17 THEN r.blocked_count ELSE 0 END as blocked_count,
  CASE WHEN r.project_id = 17 THEN r.total_tests ELSE 0 END as total_tests,
  r.month_key,
  
  -- Business Logic: Effective Start Date
  -- If cycle name contains a date, parse it? Or use created_on.
  -- Current logic: Use created_on.
  DATE(r.created_on) as eff_start_date,
  
  -- Business Logic: Effective Due Date
  -- Often in description or milestone due date. 
  -- Placeholder: created_on + 14 days
  DATE_ADD(DATE(r.created_on), INTERVAL 14 DAY) as eff_due_date,
  
  -- KPI: On Time Start (Project 17 Only)
  -- Logic: If started within X days of plan start? 
  -- Placeholder: Always true for now unless we have a 'planned_start_date'
  CASE WHEN r.project_id = 17 THEN TRUE ELSE NULL END as on_time_start,
  
  -- KPI: On Time End (Project 17 Only)
  -- Logic: completed_on <= eff_due_date
  CASE 
    WHEN r.project_id = 17 AND r.is_completed AND DATE(r.completed_on) <= DATE_ADD(DATE(r.created_on), INTERVAL 14 DAY) THEN TRUE
    ELSE FALSE 
  END as on_time_end,
  
  -- KPI: Is Blocked (Project 17 Only)
  -- Logic: If blocked_count > 0
  CASE WHEN r.project_id = 17 AND r.blocked_count > 0 THEN TRUE ELSE FALSE END as is_blocked,
  
  -- KPI: UAT Certified (Project 23 Only)
  -- Logic: If passed rate > 95% and no critical defects?
  -- Placeholder: passed_count / total_tests > 0.95
  CASE
    WHEN r.project_id = 23 AND r.total_tests > 0 AND (r.passed_count / r.total_tests) >= 0.95 THEN TRUE
    ELSE FALSE
  END as uat_certified

FROM runs r
LEFT JOIN plans p ON r.plan_id = p.id;
