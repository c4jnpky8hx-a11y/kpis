CREATE OR REPLACE VIEW `testrail_kpis.uat_timeline_kpi` AS
WITH run_result_flags AS (
    -- Per run, get the latest certification date + historical failure/defect flags
    SELECT 
        t.run_id,
        
        -- Parse the Fecha Certificación from the result custom fields (MM/DD/YYYY)
        MAX(
          SAFE.PARSE_DATE('%m/%d/%Y', 
            JSON_VALUE(r.custom_fields, '$.custom_result_fechacertificacion')
          )
        ) as fecha_certificacion,
        
        -- Historical failure: any result was failed/retest in ANY result for this run's tests
        COUNTIF(r.status_id IN (4, 5)) as failed_count,
        
        -- Historical defect linked
        COUNTIF(r.defects IS NOT NULL AND TRIM(r.defects) != '') as defects_count,
        
        -- Has Acta (signed certification document)
        COUNTIF(
          JSON_VALUE(r.custom_fields, '$.custom_result_acta_certificacion') IS NOT NULL
          AND JSON_VALUE(r.custom_fields, '$.custom_result_acta_certificacion') != ''
        ) as acta_count
        
    FROM `testrail_kpis.raw_results` r
    JOIN `testrail_kpis.dedup_tests` t ON r.test_id = t.id
    GROUP BY 1
),
uat_runs AS (
    -- Aggregate run-level data
    SELECT 
        r.run_id,
        r.run_name,
        r.month_key,
        
        -- Use Fecha Certificación when available, fall back to month_key
        COALESCE(
          FORMAT_DATE('%Y-%m', rf.fecha_certificacion),
          r.month_key
        ) as effective_month,

        COUNT(t.id) as total_tests,
        COUNTIF(t.status_id = 1) as passed_tests,
        MAX(rf.failed_count) as total_failed_history,
        MAX(rf.defects_count) as total_defects_history,
        MAX(rf.acta_count) as total_acta
        
    FROM `testrail_kpis.stg_Runs` r
    LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
    LEFT JOIN run_result_flags rf ON r.run_id = rf.run_id
    WHERE r.project_id = 12
    GROUP BY 1, 2, 3, 4
)
SELECT 
    effective_month as month_key,
    -- Certified Clean: 100% passed, 0 historical fails, 0 historical defects
    COUNTIF(
      passed_tests = total_tests 
      AND total_tests > 0 
      AND COALESCE(total_failed_history, 0) = 0
      AND COALESCE(total_defects_history, 0) = 0
    ) as uat_cert_clean,
    -- Certified with Defects: 100% passed, but had historical fails or defects
    COUNTIF(
      passed_tests = total_tests 
      AND total_tests > 0 
      AND (COALESCE(total_failed_history, 0) > 0 OR COALESCE(total_defects_history, 0) > 0)
    ) as uat_cert_defects,
    -- In Process: not 100% passed
    COUNTIF(passed_tests < total_tests OR total_tests = 0) as uat_in_process 
FROM uat_runs
WHERE effective_month IS NOT NULL
GROUP BY 1
ORDER BY 1;
