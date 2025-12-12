-- Gold Layer: KPI Marts

-- 1. KPI by Month (General Performance)
CREATE OR REPLACE TABLE `testrail_kpis.kpi_monthly_performance`
AS
SELECT
  month_key,
  COUNT(DISTINCT cycle_id) as total_cycles,
  COUNTIF(on_time_start) as on_time_start_count,
  COUNTIF(on_time_end) as on_time_end_count,
  SAFE_DIVIDE(COUNTIF(on_time_start), COUNT(DISTINCT cycle_id)) as on_time_start_pct,
  SAFE_DIVIDE(COUNTIF(on_time_end), COUNT(DISTINCT cycle_id)) as on_time_end_pct,
  COUNTIF(is_blocked) as blocked_cycles_count,
  AVG(DATE_DIFF(completed_on, created_on, DAY)) as avg_cycle_duration_days
FROM `testrail_kpis.fact_cycle`
GROUP BY month_key
ORDER BY month_key DESC;

-- 2. KPI by Plan (Plan Level Aggregation)
CREATE OR REPLACE TABLE `testrail_kpis.kpi_by_plan`
AS
SELECT
  plan_id,
  plan_name,
  month_key,
  COUNT(cycle_id) as total_runs,
  COUNTIF(is_closed) as closed_runs,
  SUM(passed_count) as total_passed,
  SUM(failed_count) as total_failed,
  SUM(blocked_count) as total_blocked,
  SAFE_DIVIDE(SUM(passed_count), SUM(total_tests)) as pass_rate
FROM `testrail_kpis.fact_cycle`
GROUP BY 1, 2, 3;

-- 3. KPI UAT Certification
CREATE OR REPLACE TABLE `testrail_kpis.kpi_uat_certification`
AS
SELECT
  month_key,
  project_id,
  COUNT(cycle_id) as total_uat_cycles,
  COUNTIF(uat_certified) as certified_cycles,
  SAFE_DIVIDE(COUNTIF(uat_certified), COUNT(cycle_id)) as certification_rate
FROM `testrail_kpis.fact_cycle`
-- Assuming UAT cycles are identified by naming convention or specific project/suite
-- For now, including all, but normally would filter WHERE cycle_name LIKE '%UAT%'
GROUP BY 1, 2;
