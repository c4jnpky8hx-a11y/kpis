-- Dashboard Mart: Aggregates for Looker Studio
-- Refined based on user feedback and images

CREATE OR REPLACE VIEW `testrail_kpis.dashboard_mart` AS
WITH 
-- 1. Defect Counts per Run (from Results joined with Tests and Cases)
run_defects_priority AS (
  SELECT 
    t.run_id,
    c.priority_id,
    COUNT(DISTINCT r.defects) as defects_count,
    COUNTIF(r.defects IS NOT NULL AND r.defects != '') as results_with_defects,
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
    SUM(COALESCE(rdp.iterations_count, 0)) as iterations_count,
    
    -- Priority Breakdown (Assuming IDs: 1=Low, 2=Medium, 3=High, 4=Critical - Example)
    -- We will just sum by priority_id and let Looker handle mapping if needed, 
    -- or pivot here if we know IDs. Let's pivot common ones.
    SUM(IF(rdp.priority_id = 4, rdp.results_with_defects, 0)) as defects_critical,
    SUM(IF(rdp.priority_id = 3, rdp.results_with_defects, 0)) as defects_high,
    SUM(IF(rdp.priority_id = 2, rdp.results_with_defects, 0)) as defects_medium,
    SUM(IF(rdp.priority_id = 1, rdp.results_with_defects, 0)) as defects_low
    
  FROM `testrail_kpis.stg_Runs` r
  LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
  LEFT JOIN run_defects_priority rdp ON r.run_id = rdp.run_id
  GROUP BY 1, 2, 3, 4
),

-- 3. Plan Aggregates
plan_aggs AS (
  SELECT
    r.plan_id,
    r.plan_name,
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
    SUM(rs.defects_count) as total_defects,
    SUM(rs.iterations_count) as total_iterations,
    
    -- Priority Defects
    SUM(rs.defects_critical) as total_defects_critical,
    SUM(rs.defects_high) as total_defects_high,
    SUM(rs.defects_medium) as total_defects_medium,
    SUM(rs.defects_low) as total_defects_low,
    
    -- Active Defects (Proxy)
    SUM(IF(r.is_completed_run = FALSE, rs.defects_count, 0)) as active_defects_proxy,
    
    -- On Time Metrics
    SUM(r.on_time_to_qa) as on_time_to_qa_count,
    SUM(r.on_time_from_qa) as on_time_from_qa_count,
    COUNT(r.run_id) as total_runs,
    
    -- Deviation
    AVG(r.desviacion_inicio) as avg_desviacion_inicio,
    
    -- Plan Completion Status
    MAX(p.is_completed) as plan_is_completed,
    
    -- Dates
    MAX(r.eff_plan_start_on) as plan_start_date,
    MAX(r.eff_plan_due_on) as plan_due_date
    
  FROM `testrail_kpis.stg_Runs` r
  JOIN `testrail_kpis.dedup_plans` p ON r.plan_id = p.id
  LEFT JOIN run_stats rs ON r.run_id = rs.run_id
  GROUP BY 1, 2, 3, 4, 5
)

SELECT
  month_key,
  plan_id,
  plan_name as Iniciativa,
  project_id,
  
  -- 1. Iniciativas Certificadas / En Proceso (Excluding UAT/Practice)
  CASE 
    WHEN project_id IN (12, 21) THEN NULL
    WHEN plan_is_completed THEN 'Certificada'
    ELSE 'En Proceso'
  END as Estado_Iniciativa,
  
  IF(project_id NOT IN (12, 21) AND plan_is_completed, 1, 0) as is_certified,
  IF(project_id NOT IN (12, 21) AND NOT plan_is_completed, 1, 0) as is_in_process,
  
  -- 2. UAT Metrics (Project 12 Only)
  -- Soluciones Devueltas
  IF(project_id = 12, total_defects, 0) as Soluciones_Devueltas_UAT,
  
  -- Soluciones Certificadas (Completed AND Signed)
  IF(project_id = 12 AND plan_is_completed AND acta_certificacion IS NOT NULL, 1, 0) as Soluciones_Certificadas_UAT,
  
  -- Iniciativas Firmadas (Signed)
  IF(project_id = 12 AND acta_certificacion IS NOT NULL, 1, 0) as Iniciativas_Firmadas_UAT,
  
  -- Iteraciones (Reincidencia)
  IF(project_id = 12, total_iterations, 0) as Iteraciones_UAT,
  
  -- 3. Soluciones Aceptadas (Passed Cases)
  total_passed as Soluciones_Aceptadas_General,
  
  -- 4. Entrega a Tiempo & Desviacion
  on_time_to_qa_count,
  on_time_from_qa_count,
  total_runs,
  SAFE_DIVIDE(on_time_to_qa_count, total_runs) as on_time_to_qa_rate,
  SAFE_DIVIDE(on_time_from_qa_count, total_runs) as on_time_from_qa_rate,
  avg_desviacion_inicio,
  
  -- 5. Defectos por Iniciativa & Prioridad
  total_defects as Total_Defectos,
  active_defects_proxy as Defectos_Activos,
  total_defects_critical,
  total_defects_high,
  total_defects_medium,
  total_defects_low,
  
  -- Chart Metrics
  total_returned_cases,
  total_in_process,
  total_blocked,
  total_untested

FROM plan_aggs;
