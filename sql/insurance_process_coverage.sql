-- Insurance Process Coverage: Classifies test cases by insurance business process
-- Algorithm: matches plan names, case titles, and project names against known insurance domains
-- Goal: identify which insurance processes are being tested and which may have gaps

CREATE OR REPLACE VIEW `testrail_kpis.insurance_process_coverage` AS
WITH
-- All test executions with plan/case context
test_data AS (
  SELECT
    t.id as test_id,
    t.case_id,
    c.title as case_title,
    r.id as run_id,
    r.project_id,
    proj.name as project_name,
    COALESCE(p.name, r.name) as plan_name,
    r.created_on,
    FORMAT_TIMESTAMP('%Y-%m', r.created_on) as month_key,
    t.status_id
  FROM testrail_kpis.dedup_tests t
  JOIN testrail_kpis.dedup_runs r ON t.run_id = r.id
  JOIN testrail_kpis.raw_cases c ON t.case_id = c.id
  LEFT JOIN testrail_kpis.dedup_plans p ON r.plan_id = p.id
  JOIN (SELECT * EXCEPT(rn) FROM (SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) rn FROM testrail_kpis.raw_projects) WHERE rn=1) proj ON r.project_id = proj.id
  WHERE proj.is_completed = FALSE
    AND proj.id NOT IN (15, 17, 7, 9, 19) -- exclude test/example projects
),

-- Classification algorithm: match against insurance process keywords
classified AS (
  SELECT
    *,
    CASE
      -- Emisión y Cotización (Underwriting)
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%cotizaci%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%tarifa%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%emisi%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%suscripci%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%p_liza%'  -- póliza with accent variations
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%poliza%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%asegurado%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%landing%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%emision%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%suscripci%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%wtw%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%baje%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%validaci%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%lista%restrictiva%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%lista%penal%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%lista%informativa%'
        OR project_name = 'Web Service Cotización Auto'
        THEN 'Emisión y Cotización'

      -- Pagos y Cobranza
      WHEN LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%pago%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%cobr%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%prima%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%saldo%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%yappy%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%tarjeta%cr%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%pronto pago%'
        OR project_name = 'Mi Pago'
        THEN 'Pagos y Cobranza'

      -- Siniestros e Indemnizaciones (Claims)
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%siniestro%'
        OR LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%indemnizac%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%reclam%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%reserva%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%apertura%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%dataloader%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%orbika%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%assistance%'
        OR project_name = 'Celula Indemnizaciones'
        THEN 'Siniestros e Indemnizaciones'

      -- Comisiones y Corredores (Commissions & Brokers)
      WHEN LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%comisi%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%corredor%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%autogesti%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%licencia%corredor%'
        OR project_name IN ('Comisiones 1', 'Comisiones')
        THEN 'Comisiones y Corredores'

      -- Core de Seguros (Insurance Core Systems)
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%insis%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%core%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%migraci%bus%'
        OR project_name = 'INSIS'
        OR project_name = 'Migración del Bus'
        THEN 'Core de Seguros (INSIS)'

      -- Portal Digital y Autogestión
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%digital%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%portal%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%imprimible%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%cloudflare%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%ejecutivo%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%link de pago%'
        OR project_name = 'SURA Digital'
        THEN 'Portal Digital y Autogestión'

      -- Data Warehouse y Analítica
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%dwh%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%affinity%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%universo%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%anal_tica%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%carga hist%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%ods%'
        OR project_name = 'DWH SURA'
        THEN 'Data Warehouse y Analítica'

      -- Automatización y Regresión
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%automat%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%regresi%'
        OR project_name = 'Automatizaciones'
        THEN 'Automatización y Regresión'

      -- Cancelaciones y Operaciones
      WHEN LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%cancelaci%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%masiv%'
        OR LOWER(CONCAT(plan_name, ' ', case_title)) LIKE '%ajuste%'
        THEN 'Cancelaciones y Operaciones'

      -- UAT y Certificación
      WHEN LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%uat%'
        OR LOWER(CONCAT(plan_name, ' ', case_title, ' ', project_name)) LIKE '%certificaci%'
        OR project_name = 'Repositorio UAT'
        OR project_name = 'Certificacion de KPIs'
        THEN 'UAT y Certificación'

      ELSE 'Sin Clasificar'
    END as insurance_process
  FROM test_data
)

SELECT
  insurance_process,
  COUNT(DISTINCT test_id) as total_tests,
  COUNT(DISTINCT case_id) as unique_cases,
  COUNT(DISTINCT run_id) as total_runs,
  COUNT(DISTINCT project_id) as projects_involved,
  COUNTIF(status_id = 1) as passed,
  COUNTIF(status_id = 5) as failed,
  COUNTIF(status_id NOT IN (1, 5)) as other_status,
  STRING_AGG(DISTINCT project_name, ', ' ORDER BY project_name) as projects,
  MIN(created_on) as first_test,
  MAX(created_on) as last_test
FROM classified
GROUP BY 1
ORDER BY total_tests DESC;
