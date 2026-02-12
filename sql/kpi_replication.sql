-- 1. Deduplicate Runs
CREATE OR REPLACE VIEW `testrail_kpis.dedup_runs` AS
SELECT * FROM `testrail_kpis.raw_runs`
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY _extracted_at DESC) = 1;

-- 2. Deduplicate Plans
CREATE OR REPLACE VIEW `testrail_kpis.dedup_plans` AS
SELECT * FROM `testrail_kpis.raw_plans`
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY _extracted_at DESC) = 1;

-- 3. Deduplicate Milestones
CREATE OR REPLACE VIEW `testrail_kpis.dedup_milestones` AS
SELECT * FROM `testrail_kpis.raw_milestones`
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY _extracted_at DESC) = 1;

-- 4. Deduplicate Tests
CREATE OR REPLACE VIEW `testrail_kpis.dedup_tests` AS
SELECT * FROM `testrail_kpis.raw_tests`
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY _extracted_at DESC) = 1;

-- 5. Staging Layer: stg_Runs
CREATE OR REPLACE VIEW `testrail_kpis.stg_Runs` AS
WITH plan_max_dates AS (
  SELECT 
    plan_id,
    MAX(COALESCE(completed_on, created_on, TIMESTAMP_SECONDS(0))) as max_date
  FROM `testrail_kpis.dedup_runs`
  WHERE project_id NOT IN (12, 21, 7)
  GROUP BY plan_id
)
SELECT
  r.project_id,
  r.plan_id,
  p.name as plan_name,
  r.id as run_id,
  r.name as run_name,
  r.milestone_id,
  m.name as milestone_name,
  r.created_on as created_on_run,
  r.completed_on as completed_on_run,
  r.is_completed as is_completed_run,
  r.assignedto_id, -- Added for Analyst mapping
  
  -- UAT Specific: Acta de Certificación (Signed)
  -- Placeholder key: custom_acta_de_certificacin (needs verification)
  COALESCE(
    JSON_VALUE(p.custom_fields, '$.custom_acta_de_certificacin'),
    JSON_VALUE(p.custom_fields, '$.custom_acta_certificacion')
  ) as acta_certificacion,
  
  -- Plan Start/Due Dates
  COALESCE(
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio')),
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechainicio')),
    p.created_on 
  ) as eff_plan_start_on,
  
  COALESCE(
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_finalizacion')),
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechafinal')),
    p.completed_on 
  ) as eff_plan_due_on,

  -- Logic: On Time to QA
  CASE 
    WHEN r.created_on IS NOT NULL AND 
         COALESCE(
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio')),
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechainicio'))
         ) IS NOT NULL 
    THEN 
      IF(r.created_on <= COALESCE(
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio')),
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechainicio'))
         ), 1, 0)
    ELSE 0
  END as on_time_to_qa,

  -- Logic: On Time from QA
  CASE
    WHEN r.is_completed AND r.completed_on IS NOT NULL AND
         COALESCE(
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_finalizacion')),
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechafinal'))
         ) IS NOT NULL
    THEN
      IF(r.completed_on <= COALESCE(
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_finalizacion')),
            SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechafinal'))
         ), 1, 0)
    ELSE 0
  END as on_time_from_qa,

  -- Logic: is_blocked
  CASE
    WHEN (
      m.id IS NOT NULL AND (
        JSON_VALUE(m.custom_fields, '$.custom_fecha_de_inicio') IS NOT NULL OR
        JSON_VALUE(m.custom_fields, '$.custom_fechainicio') IS NOT NULL
      )
    ) AND (
      p.id IS NOT NULL AND 
      JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio') IS NULL AND
      JSON_VALUE(p.custom_fields, '$.custom_fechainicio') IS NULL
    ) THEN 1
    ELSE 0
  END as is_blocked,

  -- Logic: is_last_cycle
  CASE
    WHEN r.plan_id IS NOT NULL AND pmd.max_date IS NOT NULL AND
         COALESCE(r.completed_on, r.created_on, TIMESTAMP_SECONDS(0)) = pmd.max_date
    THEN 1
    ELSE 0
  END as is_last_cycle,
  
  -- Logic: Start Date Deviation (Days)
  DATE_DIFF(
    COALESCE(r.created_on, TIMESTAMP_SECONDS(0)),
    COALESCE(
        SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio')),
        SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechainicio')),
        r.created_on
    ),
    DAY
  ) as desviacion_inicio,

  FORMAT_TIMESTAMP('%Y-%m', COALESCE(r.created_on, r.completed_on)) as month_key

FROM `testrail_kpis.dedup_runs` r
LEFT JOIN `testrail_kpis.dedup_plans` p ON r.plan_id = p.id
LEFT JOIN `testrail_kpis.dedup_milestones` m ON r.milestone_id = m.id
LEFT JOIN plan_max_dates pmd ON r.plan_id = pmd.plan_id;

-- 6. KPI Layer: KPIs_Plan (Legacy - Excludes 12, 21)
CREATE OR REPLACE VIEW `testrail_kpis.KPIs_Plan` AS
SELECT
  plan_name,
  COUNT(run_id) as Runs,
  SUM(on_time_to_qa) as Inicio_a_Tiempo,
  SUM(on_time_from_qa) as Finalizacion_a_Tiempo,
  SUM(is_blocked) as Bloqueados
FROM `testrail_kpis.stg_Runs`
WHERE plan_name IS NOT NULL AND project_id NOT IN (12, 21)
GROUP BY 1;

-- 7. KPI Layer: KPIs_Mes (Legacy - Excludes 12, 21)
CREATE OR REPLACE VIEW `testrail_kpis.KPIs_Mes` AS
SELECT
  month_key,
  COUNT(run_id) as Runs,
  SUM(on_time_to_qa) as Inicio_a_Tiempo,
  SUM(on_time_from_qa) as Finalizacion_a_Tiempo,
  SUM(is_blocked) as Bloqueados
FROM `testrail_kpis.stg_Runs`
WHERE month_key IS NOT NULL AND project_id NOT IN (12, 21)
GROUP BY 1;
