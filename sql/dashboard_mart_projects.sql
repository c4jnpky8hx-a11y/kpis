-- Dashboard Mart Projects: Project-Level Summary with Analysts
-- Granularity: One row per Active Project

CREATE OR REPLACE VIEW `testrail_kpis.dashboard_mart_projects` AS
WITH 
-- 1. Active Plans Count
active_plans AS (
  SELECT 
    project_id, 
    COUNT(id) as active_plans_count 
  FROM `testrail_kpis.dedup_plans` 
  WHERE is_completed = false 
  GROUP BY 1
),

-- 2. Total Cases in Repository (Active Suites)
repo_cases AS (
  SELECT 
    s.project_id, 
    COUNT(c.id) as total_cases_repo
  FROM (
      SELECT * FROM `testrail_kpis.raw_cases`
      QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) = 1
  ) c
  JOIN (
      SELECT * FROM `testrail_kpis.raw_suites`
      QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) = 1
  ) s ON c.suite_id = s.id
  WHERE c.is_deleted = 0
  GROUP BY 1
),

-- 3. Execution Stats & Analysts from Mart/Runs
exec_stats AS (
  SELECT 
    m.project_id,
    SUM(m.total_tests) as total_tests_execution,
    SUM(m.total_passed) as total_passed,
    SUM(m.total_returned_cases) as total_returned, -- Failed + Retest
    SUM(m.total_blocked) as total_blocked,
    SUM(m.total_in_process) as total_in_process,
    SUM(m.total_untested) as total_untested,
    SUM(m.Total_Defectos) as total_defects,
    SUM(m.Defectos_Activos) as active_defects
  FROM `testrail_kpis.dashboard_mart` m
  GROUP BY 1
),

-- 4. Analysts (Users assigned to active runs)
-- We need to link Runs -> AssignedTo -> Users table
project_analysts AS (
  SELECT
    r.project_id,
    STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) as analysts
  FROM `testrail_kpis.dedup_runs` r
  LEFT JOIN (
      SELECT * FROM `testrail_kpis.raw_users`
      QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) = 1
  ) u ON r.assignedto_id = u.id
  WHERE r.is_completed = false
  AND u.name IS NOT NULL
  GROUP BY 1
)

SELECT
  p.id as project_id,
  p.name as project_name,
  
  -- Metrics
  COALESCE(ap.active_plans_count, 0) as active_plans,
  COALESCE(rc.total_cases_repo, 0) as total_cases_repo,
  COALESCE(es.total_tests_execution, 0) as total_tests_execution,
  
  -- Status Breakdown
  COALESCE(es.total_passed, 0) as status_passed,
  COALESCE(es.total_returned, 0) as status_returned,
  COALESCE(es.total_blocked, 0) as status_blocked,
  COALESCE(es.total_in_process, 0) as status_in_process,
  COALESCE(es.total_untested, 0) as status_pending,
  
  -- Defects
  COALESCE(es.active_defects, 0) as active_defects,
  
  -- Team
  COALESCE(pa.analysts, 'Unassigned') as analysts
  
FROM (
  SELECT * FROM `testrail_kpis.raw_projects`
  QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) = 1
) p
LEFT JOIN active_plans ap ON p.id = ap.project_id
LEFT JOIN repo_cases rc ON p.id = rc.project_id
LEFT JOIN exec_stats es ON p.id = es.project_id
LEFT JOIN project_analysts pa ON p.id = pa.project_id

-- Filter: Only Active Projects
WHERE p.is_completed = false
AND p.id NOT IN (1, 3, 7, 9, 17, 18, 19, 21, 23);
