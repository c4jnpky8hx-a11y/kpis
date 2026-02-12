-- Dashboard Pruebas: Clone of dashboard_mart for validation
-- Logic:
-- Project 17 = General Stats (excluded from main charts)
-- Project 12 = UAT Stats (Repositorio UAT)

CREATE OR REPLACE VIEW `testrail_kpis.dashboard_pruebas` AS
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
    
    -- Defect Counts (Joined)
    SUM(COALESCE(rdp.results_with_defects, 0)) as defects_count,
    SUM(COALESCE(rdp.acta_count, 0)) as total_acta_count,
    SUM(COALESCE(rdp.iterations_count, 0)) as iterations_count,
    
    -- Priority Breakdown
    SUM(IF(rdp.priority_id = 4, rdp.results_with_defects, 0)) as defects_critical,
    SUM(IF(rdp.priority_id = 3, rdp.results_with_defects, 0)) as defects_high,
    SUM(IF(rdp.priority_id = 2, rdp.results_with_defects, 0)) as defects_medium,
    SUM(IF(rdp.priority_id = 1, rdp.results_with_defects, 0)) as defects_low,

    -- UAT Flags (Per Run Calculation)
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
  -- FILTER: Only include General stats and UAT project
  WHERE r.project_id IN (17, 12)
  GROUP BY 1, 2, 3, 4
),

-- 3. Plan Aggregates
plan_aggs AS (
  SELECT
    COALESCE(r.plan_id, r.run_id) as plan_id,
    COALESCE(r.plan_name, r.run_name) as plan_name,
    r.month_key,
    r.project_id,
    r.acta_certificacion, -- From stg_Runs
    
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
    
    -- Priority Defects
    SUM(rs.defects_critical) as total_defects_critical,
    SUM(rs.defects_high) as total_defects_high,
    SUM(rs.defects_medium) as total_defects_medium,
    SUM(rs.defects_low) as total_defects_low,
    
    -- UAT Aggregates (Sum of Flags)
    SUM(rs.is_uat_returned) as total_uat_returned,
    SUM(rs.is_uat_certified) as total_uat_certified,
    SUM(rs.is_uat_signed) as total_uat_signed,
    SUM(rs.is_uat_in_process) as total_uat_in_process,
    
    -- Active Defects (Proxy)
    SUM(IF(r.is_completed_run = FALSE, rs.defects_count, 0)) as active_defects_proxy,
    
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
  LEFT JOIN `testrail_kpis.raw_users` u ON r.assignedto_id = u.id
  -- FILTER: Only include General stats and UAT project
  WHERE r.project_id IN (17, 12)
  GROUP BY 1, 2, 3, 4, 5
)

SELECT
  month_key,
  plan_id,
  plan_name as Iniciativa,
  project_id,
  
  -- 1. Iniciativas Certificadas / En Proceso (Excluding UAT - Project 12)
  -- Strict Logic: Only Project 17 shows status. Project 12 is NULL/0.
  CASE 
    WHEN project_id != 17 THEN NULL
    WHEN plan_is_completed THEN 'Certificada'
    ELSE 'En Proceso'
  END as Estado_Iniciativa,
  
  IF(project_id = 17 AND plan_is_completed, 1, 0) as is_certified,
  IF(project_id = 17 AND NOT plan_is_completed, 1, 0) as is_in_process,
  
  -- 2. UAT Metrics (Project 12 - Repositorio UAT)
  -- Soluciones Devueltas: Sum of Runs flagged as Returned
  IF(project_id = 12, total_uat_returned, 0) as Soluciones_Devueltas_UAT,
  
  -- Soluciones Certificadas: Sum of Runs flagged as Certified
  IF(project_id = 12, total_uat_certified, 0) as Soluciones_Certificadas_UAT,
  
  -- Iniciativas Firmadas: Sum of Runs flagged as Signed
  IF(project_id = 12, total_uat_signed, 0) as Iniciativas_Firmadas_UAT,
  
  -- Soluciones En Proceso: Sum of Runs flagged as In Process
  IF(project_id = 12, total_uat_in_process, 0) as Soluciones_En_Proceso_UAT,
  
  -- Iteraciones (Reincidencia)
  IF(project_id = 12, total_iterations, 0) as Iteraciones_UAT,
  
  -- 3. Soluciones Aceptadas (Passed Cases) - UAT Indicator (Project 12)
  IF(project_id = 12, total_passed, 0) as Soluciones_Aceptadas_General,
  
  -- 4. Entrega a Tiempo & Desviacion
  IF(project_id = 17, on_time_to_qa_count, 0) as on_time_to_qa_count,
  IF(project_id = 17, on_time_from_qa_count, 0) as on_time_from_qa_count,
  IF(project_id = 17, total_runs, 0) as total_runs,
  SAFE_DIVIDE(IF(project_id = 17, on_time_to_qa_count, 0), IF(project_id = 17, total_runs, 0)) as on_time_to_qa_rate,
  SAFE_DIVIDE(IF(project_id = 17, on_time_from_qa_count, 0), IF(project_id = 17, total_runs, 0)) as on_time_from_qa_rate,
  IF(project_id = 17, avg_desviacion_inicio, NULL) as avg_desviacion_inicio,
  
  -- 5. Defectos por Iniciativa & Prioridad
  IF(project_id = 17, total_defects, 0) as Total_Defectos,
  IF(project_id = 17, active_defects_proxy, 0) as Defectos_Activos,
  IF(project_id = 17, total_defects_critical, 0) as total_defects_critical,
  IF(project_id = 17, total_defects_high, 0) as total_defects_high,
  IF(project_id = 17, total_defects_medium, 0) as total_defects_medium,
  IF(project_id = 17, total_defects_low, 0) as total_defects_low,
  
  -- Chart Metrics
  IF(project_id = 17, total_returned_cases, 0) as total_returned_cases,
  IF(project_id = 17, total_in_process, 0) as total_in_process,
  IF(project_id = 17, total_blocked, 0) as total_blocked,
  IF(project_id = 17, total_untested, 0) as total_untested,
  
  -- Raw Metrics (Parity with Mart)
  total_tests,
  total_passed,
  total_defects,
  active_defects_proxy,
  analysts

FROM plan_aggs;
