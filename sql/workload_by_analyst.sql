-- Workload by Analyst: Shows active test case assignments per analyst per project
-- Used by the dashboard to visualize QA team workload distribution

CREATE OR REPLACE VIEW `testrail_kpis.workload_by_analyst` AS
WITH active_assignments AS (
  SELECT
    t.assignedto_id,
    r.project_id,
    proj.name as project_name,
    t.status_id,
    t.id as test_id
  FROM testrail_kpis.dedup_tests t
  JOIN testrail_kpis.dedup_runs r ON t.run_id = r.id
  JOIN (
    SELECT * EXCEPT(rn) FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) rn 
      FROM `testrail_kpis.raw_projects`
    ) WHERE rn = 1
  ) proj ON r.project_id = proj.id
  WHERE 
    t.assignedto_id IS NOT NULL
    AND t.assignedto_id > 0
    AND proj.is_completed = FALSE
    -- Exclude test/example/internal/closed projects
    AND r.project_id NOT IN (1, 3, 7, 9, 17, 18, 19, 21, 23)
)
SELECT
  a.assignedto_id,
  COALESCE(u.name, CONCAT('Analista #', CAST(a.assignedto_id AS STRING))) as analyst_name,
  a.project_id,
  a.project_name,
  COUNT(DISTINCT a.test_id) as total_assigned,
  COUNTIF(a.status_id NOT IN (1, 5)) as active_cases,   -- Not passed(1) or failed(5) = still working
  COUNTIF(a.status_id = 1) as passed_cases,
  COUNTIF(a.status_id = 5) as failed_cases,
  COUNTIF(a.status_id = 2) as blocked_cases,
  COUNTIF(a.status_id = 3) as untested_cases,
  COUNTIF(a.status_id = 4) as retest_cases
FROM active_assignments a
LEFT JOIN testrail_kpis.raw_users u ON a.assignedto_id = u.id
GROUP BY 1, 2, 3, 4
ORDER BY total_assigned DESC;
