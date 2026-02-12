WITH linked_info AS (
  SELECT DISTINCT
    key as extracted_key,
    sr.plan_id,
    sr.project_id,
    COALESCE(sr.plan_name, sr.run_name) as plan_name,
    p.name as project_name
  FROM `testrail_kpis.raw_results` r
  JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
  JOIN `testrail_kpis.stg_Runs` sr ON t.run_id = sr.run_id
  JOIN `testrail_kpis.raw_projects` p ON sr.project_id = p.id,
  UNNEST(REGEXP_EXTRACT_ALL(r.defects, r'(CM-\d+)')) as key
  WHERE r.defects LIKE '%CM-%'
)

SELECT
  j.id,
  j.key,
  j.summary,
  j.status,
  j.priority,
  j.resolution,
  j.assignee,
  j.reporter,
  j.created,
  j.updated,
  j.url,
  
  -- Calculated Fields
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), j.created, DAY) as age_days,
  
  -- Linkage Info
  CASE WHEN COUNT(li.extracted_key) > 0 THEN TRUE ELSE FALSE END as is_linked,
  STRING_AGG(DISTINCT li.plan_name, ', ') as linked_plans,
  STRING_AGG(DISTINCT li.project_name, ', ') as linked_projects

FROM `testrail_kpis.raw_jira_issues` j
LEFT JOIN linked_info li ON j.key = li.extracted_key
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11;
