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
  r.passed_count,
  r.failed_count,
  r.blocked_count,
  r.total_tests,
  r.month_key,
  
  -- Business Logic: Effective Start Date
  -- If cycle name contains a date, parse it? Or use created_on.
  -- Current logic: Use created_on.
  DATE(r.created_on) as eff_start_date,
  
  -- Business Logic: Effective Due Date
  -- Often in description or milestone due date. 
  -- Placeholder: created_on + 14 days
  DATE_ADD(DATE(r.created_on), INTERVAL 14 DAY) as eff_due_date,
  
  -- KPI: On Time Start
  -- Logic: If started within X days of plan start? 
  -- Placeholder: Always true for now unless we have a 'planned_start_date'
  TRUE as on_time_start,
  
  -- KPI: On Time End
  -- Logic: completed_on <= eff_due_date
  CASE 
    WHEN r.is_completed AND DATE(r.completed_on) <= DATE_ADD(DATE(r.created_on), INTERVAL 14 DAY) THEN TRUE
    ELSE FALSE 
  END as on_time_end,
  
  -- KPI: Is Blocked
  -- Logic: If blocked_count > 0
  (r.blocked_count > 0) as is_blocked,
  
  -- KPI: UAT Certified
  -- Logic: If passed rate > 95% and no critical defects?
  -- Placeholder: passed_count / total_tests > 0.95
  CASE
    WHEN r.total_tests > 0 AND (r.passed_count / r.total_tests) >= 0.95 THEN TRUE
    ELSE FALSE
  END as uat_certified

FROM runs r
LEFT JOIN plans p ON r.plan_id = p.id;
