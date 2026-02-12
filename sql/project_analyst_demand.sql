-- Project Analyst Demand Over Time
-- Shows how many analysts each project is consuming per month
-- Used for the time-series demand chart in the dashboard

CREATE OR REPLACE VIEW `testrail_kpis.project_analyst_demand` AS
SELECT
  r.project_id,
  proj.name as project_name,
  FORMAT_TIMESTAMP('%Y-%m', r.created_on) as month_key,
  EXTRACT(YEAR FROM r.created_on) as year,
  COUNT(DISTINCT t.assignedto_id) as analyst_count,
  COUNT(DISTINCT t.id) as test_count,
  STRING_AGG(DISTINCT COALESCE(u.name, CONCAT('Analista #', CAST(t.assignedto_id AS STRING))), ', ' ORDER BY COALESCE(u.name, CONCAT('Analista #', CAST(t.assignedto_id AS STRING)))) as analyst_names
FROM testrail_kpis.dedup_tests t
JOIN testrail_kpis.dedup_runs r ON t.run_id = r.id
JOIN (
  SELECT * EXCEPT(rn) FROM (
    SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) rn 
    FROM `testrail_kpis.raw_projects`
  ) WHERE rn = 1
) proj ON r.project_id = proj.id
LEFT JOIN testrail_kpis.raw_users u ON t.assignedto_id = u.id
WHERE 
  t.assignedto_id IS NOT NULL
  AND t.assignedto_id > 0
  AND proj.is_completed = FALSE
  AND r.project_id NOT IN (1, 3, 7, 9, 17, 18, 19, 21, 23)
GROUP BY 1, 2, 3, 4
ORDER BY month_key, project_name;
