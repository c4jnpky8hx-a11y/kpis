-- Dashboard Mart: Aggregates for Looker Studio
-- Refined based on user feedback: UAT=Project 12, General=All Active (Excluding excluded list), Automation=Project 8

CREATE OR REPLACE VIEW `testrail_kpis.dashboard_mart` AS
WITH 
-- 1. Defect Counts per Run (from Results joined with Tests and Cases)
run_defects_priority AS (
  SELECT 
    t.run_id,
    c.priority_id,
    COUNT(DISTINCT r.defects) as defects_count,
    COUNTIF(r.defects IS NOT NULL AND r.defects != '') as results_with_defects,
    -- Count results with Acta de Certificacion link
    COUNTIF(JSON_VALUE(r.custom_fields, '$.custom_result_acta_certificacion') IS NOT NULL) as acta_count,
    -- Iterations (Reincidencia) - Placeholder key
    COUNTIF(JSON_VALUE(r.custom_fields, '$.custom_reincidencia') = 'true') as iterations_count
  FROM `testrail_kpis.raw_results` r
  JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
  JOIN `testrail_kpis.raw_cases` c ON t.case_id = c.id
  GROUP BY 1, 2
),

-- 2. Run Stats (Aggregated from Tests)
run_defects_jira AS (
  SELECT 
    t.run_id,
    COUNT(DISTINCT j.key) as jira_defects_count,
    
    -- Status Groups
    COUNT(DISTINCT IF(j.status IN ('Terminado', 'Cerrado', 'Cancelado', 'Mitigado'), j.key, NULL)) as jira_defects_closed,
    COUNT(DISTINCT IF(j.status NOT IN ('Terminado', 'Cerrado', 'Cancelado', 'Mitigado'), j.key, NULL)) as jira_defects_active, -- General Active
    
    -- Specific Status Counts
    COUNT(DISTINCT IF(j.status IN ('Listo para Probar'), j.key, NULL)) as status_ready,
    COUNT(DISTINCT IF(j.status IN ('Desarrollo', 'Probando', 'Analisis', 'En Diseño'), j.key, NULL)) as status_in_progress,
    COUNT(DISTINCT IF(j.status IN ('Backlog', 'Esperando Aprobación'), j.key, NULL)) as status_open,
    
    -- Severity (Priority) Counts
    COUNT(DISTINCT IF(j.priority = 'Crítica', j.key, NULL)) as severity_critical,
    COUNT(DISTINCT IF(j.priority = 'Alta', j.key, NULL)) as severity_high,
    COUNT(DISTINCT IF(j.priority = 'Media', j.key, NULL)) as severity_medium,
    COUNT(DISTINCT IF(j.priority = 'Baja', j.key, NULL)) as severity_low,

    -- Avg Age (Days from Created to Now/Updated)
    AVG(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), j.created, DAY)) as avg_defect_age_days
  FROM `testrail_kpis.raw_results` r
  JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
  LEFT JOIN UNNEST(REGEXP_EXTRACT_ALL(r.defects, r'(CM-\d+)')) as defect_key
  JOIN `testrail_kpis.raw_jira_issues` j ON defect_key = j.key
  WHERE r.defects IS NOT NULL AND r.defects != ''
  GROUP BY 1
),

run_stats AS (
  SELECT 
    r.plan_id,
    r.run_id,
    r.month_key,
    r.project_id,
    
    -- Status Counts
    COUNTIF(t.status_id = 1) as passed_count,
    COUNTIF(t.status_id = 2) as blocked_count,
    COUNTIF(t.status_id = 4) as retest_count,
    COUNTIF(t.status_id = 5) as failed_count,
    COUNTIF(t.status_id = 6) as process_count,
    COUNTIF(t.status_id = 3) as untested_count,
    COUNT(t.id) as total_tests,
    
    -- Defect Counts (TestRail)
    SUM(COALESCE(rdp.results_with_defects, 0)) as defects_count,
    SUM(COALESCE(rdp.acta_count, 0)) as total_acta_count,
    SUM(COALESCE(rdp.iterations_count, 0)) as iterations_count,
    
    -- Jira Defect Counts
    SUM(COALESCE(rdj.jira_defects_count, 0)) as jira_defects_count,
    SUM(COALESCE(rdj.jira_defects_closed, 0)) as jira_defects_closed,
    SUM(COALESCE(rdj.jira_defects_active, 0)) as jira_defects_active,
    AVG(rdj.avg_defect_age_days) as avg_jira_defect_age,
    
    -- Jira Status Breakdown
    SUM(COALESCE(rdj.status_ready, 0)) as status_ready,
    SUM(COALESCE(rdj.status_in_progress, 0)) as status_in_progress,
    SUM(COALESCE(rdj.status_open, 0)) as status_open,
    
    -- Jira Severity Breakdown
    SUM(COALESCE(rdj.severity_critical, 0)) as severity_critical,
    SUM(COALESCE(rdj.severity_high, 0)) as severity_high,
    SUM(COALESCE(rdj.severity_medium, 0)) as severity_medium,
    SUM(COALESCE(rdj.severity_low, 0)) as severity_low,

    -- UAT Flags (Updated: Logic applies to Project 12 - Repositorio UAT)
    -- Returned: Has defects OR has retest/failed cases
    CASE 
      WHEN r.project_id = 12 AND (SUM(COALESCE(rdp.results_with_defects, 0)) > 0 OR COUNTIF(t.status_id IN (4, 5)) > 0) THEN 1 
      ELSE 0 
    END as is_uat_returned,
    
    -- Certified: All Passed + NO Acta link
    CASE 
      WHEN r.project_id = 12 AND COUNT(t.id) > 0 AND COUNTIF(t.status_id = 1) = COUNT(t.id) AND SUM(COALESCE(rdp.acta_count, 0)) = 0 THEN 1
      ELSE 0
    END as is_uat_certified,
    
    -- Signed: All Passed + At least 1 Acta link
    CASE 
      WHEN r.project_id = 12 AND COUNT(t.id) > 0 AND COUNTIF(t.status_id = 1) = COUNT(t.id) AND SUM(COALESCE(rdp.acta_count, 0)) >= 1 THEN 1
      ELSE 0
    END as is_uat_signed,
    
    -- In Process: Project 12, NOT Returned, Has Valid Tests, Not fully Passed
    CASE
      WHEN r.project_id = 12
        -- Not Returned (No defects, no failures)
        AND (SUM(COALESCE(rdp.results_with_defects, 0)) = 0 AND COUNTIF(t.status_id IN (4, 5)) = 0)
        -- Has Tests
        AND COUNT(t.id) > 0
        -- Not all passed (Completion < 100%)
        AND COUNTIF(t.status_id = 1) < COUNT(t.id)
      THEN 1
      ELSE 0
    END as is_uat_in_process
    
  FROM `testrail_kpis.stg_Runs` r
  LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
  LEFT JOIN run_defects_priority rdp ON r.run_id = rdp.run_id
  LEFT JOIN run_defects_jira rdj ON r.run_id = rdj.run_id
  GROUP BY 1, 2, 3, 4
),

-- 3. Plan Aggregates
plan_aggs AS (
  SELECT
    COALESCE(r.plan_id, r.run_id) as plan_id,
    COALESCE(r.plan_name, r.run_name) as plan_name,
    r.month_key,
    r.project_id,
    proj.name as project_name, -- Added Project Name for filtering
    r.acta_certificacion, 
    
    -- Aggregated Counts
    SUM(rs.passed_count) as total_passed,
    SUM(rs.retest_count + rs.failed_count) as total_returned_cases,
    SUM(rs.process_count) as total_in_process,
    SUM(rs.blocked_count) as total_blocked,
    SUM(rs.untested_count) as total_untested,
    SUM(rs.total_tests) as total_tests,
    SUM(rs.total_acta_count) as total_acta_count,
    SUM(rs.defects_count) as total_defects,
    SUM(rs.iterations_count) as total_iterations,
    
    -- Jira Aggregates
    SUM(rs.jira_defects_count) as total_jira_defects,
    SUM(rs.jira_defects_closed) as total_jira_closed,
    SUM(rs.jira_defects_active) as total_jira_open, -- Mapped to 'active'
    AVG(rs.avg_jira_defect_age) as avg_jira_defect_age,
    
    -- Jira Status
    SUM(rs.status_ready) as total_status_ready,
    SUM(rs.status_in_progress) as total_status_in_progress,
    SUM(rs.status_open) as total_status_open,
    
    -- Jira Severity (Priority)
    SUM(rs.severity_critical) as total_severity_critical,
    SUM(rs.severity_high) as total_severity_high,
    SUM(rs.severity_medium) as total_severity_medium,
    SUM(rs.severity_low) as total_severity_low,
    
    -- UAT Aggregates (Sum of Flags)
    SUM(rs.is_uat_returned) as total_uat_returned,
    SUM(rs.is_uat_certified) as total_uat_certified,
    SUM(rs.is_uat_signed) as total_uat_signed,
    SUM(rs.is_uat_in_process) as total_uat_in_process,
    
    -- Active Defects (Proxy: Failed Cases as per User Request until Jira Integration)
    SUM(IF(r.is_completed_run = FALSE, rs.failed_count, 0)) as active_defects_proxy,
    
    -- On Time Metrics
    SUM(r.on_time_to_qa) as on_time_to_qa_count,
    SUM(r.on_time_from_qa) as on_time_from_qa_count,
    COUNT(r.run_id) as total_runs,
    
    -- Deviation
    AVG(r.desviacion_inicio) as avg_desviacion_inicio,
    
    -- Plan Completion Status
    MAX(COALESCE(p.is_completed, r.is_completed_run)) as plan_is_completed,
    
    -- Dates
    MAX(r.eff_plan_start_on) as plan_start_date,
    MAX(r.eff_plan_due_on) as plan_due_date,
    
    -- Analysts
    STRING_AGG(DISTINCT u.name, ', ' ORDER BY u.name) as analysts
    
  FROM `testrail_kpis.stg_Runs` r
  LEFT JOIN `testrail_kpis.dedup_plans` p ON r.plan_id = p.id
  LEFT JOIN run_stats rs ON r.run_id = rs.run_id
  -- Join with Projects to check for closed status
  JOIN (
    SELECT * EXCEPT(rn) FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) as rn FROM `testrail_kpis.raw_projects`
    ) WHERE rn = 1
  ) proj ON r.project_id = proj.id
  LEFT JOIN `testrail_kpis.raw_users` u ON r.assignedto_id = u.id
  
  -- FILTER: 
  -- Include Project 12 (UAT - Repositorio UAT)
  -- Include Project 8 (Automation)
  -- Include All other Active Projects EXCEPT exclusion list AND Closed Projects
  WHERE 
    r.project_id = 12 
    OR r.project_id = 8
    OR (
        r.project_id NOT IN (1, 3, 7, 8, 9, 12, 17, 18, 19, 21, 23) 
        AND proj.is_completed = FALSE 
       )
  GROUP BY 1, 2, 3, 4, 5, 6
)

SELECT
  month_key,
  plan_id,
  plan_name as Iniciativa,
  project_id,
  project_name,
  
  -- 1. Iniciativas Certificadas / En Proceso (Excluding UAT - Project 12)
  CASE 
    WHEN project_id = 12 THEN NULL
    WHEN plan_is_completed THEN 'Certificada'
    ELSE 'En Proceso'
  END as Estado_Iniciativa,
  
  IF(project_id != 12 AND plan_is_completed, 1, 0) as is_certified,
  IF(project_id != 12 AND NOT plan_is_completed, 1, 0) as is_in_process,
  
  -- 2. UAT Metrics (Project 4 Only)
  -- Soluciones Devueltas
  IF(project_id = 12, total_uat_returned, 0) as Soluciones_Devueltas_UAT,
  
  -- Soluciones Certificadas
  IF(project_id = 12, total_uat_certified, 0) as Soluciones_Certificadas_UAT,
  
  -- Iniciativas Firmadas
  IF(project_id = 12, total_uat_signed, 0) as Iniciativas_Firmadas_UAT,
  
  -- Soluciones En Proceso
  IF(project_id = 12, total_uat_in_process, 0) as Soluciones_En_Proceso_UAT,
  
  -- Iteraciones (Reincidencia)
  IF(project_id = 12, total_iterations, 0) as Iteraciones_UAT,
  
  -- 3. Soluciones Aceptadas (Passed Cases)
  -- UAT Indicator (Project 12)
  IF(project_id = 12, total_passed, 0) as Soluciones_Aceptadas_General,
  
  -- 4. Entrega a Tiempo & Desviacion (For General QA - Exclude UAT & Automation for Aggregates if needed, or keep for all)
  -- Keeping for "General" typically implies excluding UAT/Auto, but keeping calculation valid for row-level
  IF(project_id NOT IN (12, 8), on_time_to_qa_count, 0) as on_time_to_qa_count,
  IF(project_id NOT IN (12, 8), on_time_from_qa_count, 0) as on_time_from_qa_count,
  IF(project_id NOT IN (12, 8), total_runs, 0) as total_runs,
  SAFE_DIVIDE(IF(project_id NOT IN (12, 8), on_time_to_qa_count, 0), IF(project_id NOT IN (12, 8), total_runs, 0)) as on_time_to_qa_rate,
  SAFE_DIVIDE(IF(project_id NOT IN (12, 8), on_time_from_qa_count, 0), IF(project_id NOT IN (12, 8), total_runs, 0)) as on_time_from_qa_rate,
  IF(project_id NOT IN (12, 8), avg_desviacion_inicio, NULL) as avg_desviacion_inicio,
  
  -- 5. Defectos por Iniciativa & Prioridad (General QA)
  -- REPLACED: active_defects_proxy with real Jira Metrics
  IF(project_id NOT IN (12, 8), total_jira_defects, 0) as Total_Defectos,
  IF(project_id NOT IN (12, 8), total_jira_open, 0) as Defectos_Activos,
  IF(project_id NOT IN (12, 8), total_jira_closed, 0) as Defectos_Cerrados,
  
  -- Jira Severity
  IF(project_id NOT IN (12, 8), total_severity_critical, 0) as total_defects_critical,
  IF(project_id NOT IN (12, 8), total_severity_high, 0) as total_defects_high,
  IF(project_id NOT IN (12, 8), total_severity_medium, 0) as total_defects_medium,
  IF(project_id NOT IN (12, 8), total_severity_low, 0) as total_defects_low,
  
  -- Jira Status Breakdown
  IF(project_id NOT IN (12, 8), total_status_ready, 0) as total_status_ready,
  IF(project_id NOT IN (12, 8), total_status_in_progress, 0) as total_status_in_progress,
  IF(project_id NOT IN (12, 8), total_status_open, 0) as total_status_open,
  
  -- New Jira Metric
  IF(project_id NOT IN (12, 8), avg_jira_defect_age, NULL) as Promedio_Dias_Defecto,
  
  -- Chart Metrics
  IF(project_id NOT IN (12, 8), total_returned_cases, 0) as total_returned_cases,
  IF(project_id NOT IN (12, 8), total_in_process, 0) as total_in_process,
  IF(project_id NOT IN (12, 8), total_blocked, 0) as total_blocked,
  IF(project_id NOT IN (12, 8), total_untested, 0) as total_untested,

  -- Automation Specifics (Pass through all metrics, filtering handled in Looker Studio by Project ID = 8)
  IF(project_id = 8, total_passed, 0) as automation_passed,
  IF(project_id = 8, total_tests, 0) as automation_total,

  -- Raw Metrics for Downstream Views (Project Summary)
  total_tests,
  total_passed,
  IF(project_id NOT IN (12, 8), total_jira_defects, 0) as total_defects_raw,
  active_defects_proxy,
  analysts

FROM plan_aggs;
