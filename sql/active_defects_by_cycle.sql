-- View: active_defects_by_cycle
-- Returns one row per (run/cycle, active_defect) link
-- Only includes:
--   - Defects of type Defecto_TestRail or Defecto-No-Productivo
--   - Defect status NOT in (Terminado, Cerrado, Cancelado, Mitigado)
-- Frontend can group by run_id to show cycles affected by active defects.

CREATE OR REPLACE VIEW `testrail_kpis.active_defects_by_cycle` AS
WITH active_defects AS (
  SELECT key, summary, status, priority, created, url,
         TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), created, DAY) as age_days
  FROM (
    -- Order by Jira's own `updated` first; `synced_at` is the tiebreaker for legacy NULL rows.
    SELECT *, ROW_NUMBER() OVER(PARTITION BY key ORDER BY updated DESC, synced_at DESC) as rn
    FROM `testrail_kpis.raw_jira_issues`
    WHERE issue_type IN ('Defecto_TestRail', 'Defecto-No-Productivo')
      AND status NOT IN ('Terminado', 'Cerrado', 'Cancelado', 'Mitigado')
  ) WHERE rn = 1
),
defect_to_cycle AS (
  SELECT DISTINCT
    key as defect_key,
    sr.run_id,
    sr.run_name,
    sr.plan_id,
    COALESCE(sr.plan_name, sr.run_name) as plan_name,
    sr.project_id,
    p.name as project_name
  FROM `testrail_kpis.raw_results` r
  JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
  JOIN `testrail_kpis.stg_Runs` sr ON t.run_id = sr.run_id
  JOIN (
    SELECT * EXCEPT(rn) FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) as rn
      FROM `testrail_kpis.raw_projects`
    ) WHERE rn = 1
  ) p ON sr.project_id = p.id,
  UNNEST(REGEXP_EXTRACT_ALL(r.defects, r'(CM-\d+)')) as key
  WHERE r.defects LIKE '%CM-%'
)
SELECT
  d.run_id,
  d.run_name,
  d.plan_id,
  d.plan_name,
  d.project_id,
  d.project_name,
  ad.key as defect_key,
  ad.summary,
  ad.status,
  ad.priority,
  ad.age_days,
  ad.url
FROM defect_to_cycle d
JOIN active_defects ad ON d.defect_key = ad.key;
