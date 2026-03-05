WITH 
run_defects_priority AS (
  SELECT 
    t.run_id,
    COUNTIF(r.defects IS NOT NULL AND r.defects != '') as results_with_defects
  FROM `testrail_kpis.raw_results` r
  JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
  GROUP BY 1
),
run_stats AS (
  SELECT 
    r.plan_id,
    r.run_id,
    r.run_name,
    COUNT(t.id) as total_tests,
    COUNTIF(t.status_id = 1) as passed_count,
    COUNTIF(t.status_id IN (4, 5)) as returned_count,
    SUM(COALESCE(rdp.results_with_defects, 0)) as defects_count,
    r.is_completed_run
  FROM `testrail_kpis.stg_Runs` r
  LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
  LEFT JOIN run_defects_priority rdp ON r.run_id = rdp.run_id
  WHERE r.project_id = 12
  GROUP BY 1, 2, 3, 8
)
SELECT 
  run_name, 
  total_tests, 
  passed_count, 
  returned_count, 
  defects_count, 
  is_completed_run,
  CASE WHEN (defects_count > 0 OR returned_count > 0) THEN 'Returned'
       WHEN total_tests > 0 AND passed_count = total_tests THEN 'Certified/Signed'
       WHEN total_tests > 0 AND passed_count < total_tests THEN 'In Process'
       ELSE 'Empty/No Tests' END as uat_status
FROM run_stats
ORDER BY uat_status, run_name;
